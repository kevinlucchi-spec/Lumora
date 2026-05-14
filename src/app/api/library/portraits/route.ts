// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

/**
 * GET: List all portrait assets owned by the current user.
 * Portraits are ImageAssets with assetType="character_portrait" linked to the user's characters.
 */
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get all character template IDs owned by this user
  const userCharacterIds = await prisma.characterTemplate.findMany({
    where: { userId: session.user.id, archivedAt: null },
    select: { id: true },
  })
  const characterIds = userCharacterIds.map((c: { id: string }) => c.id)

  if (characterIds.length === 0) {
    return NextResponse.json({ portraits: [] })
  }

  const portraits = await prisma.imageAsset.findMany({
    where: {
      assetType: "character_portrait",
      characterTemplateId: { in: characterIds },
    },
    select: {
      id: true,
      name: true,
      url: true,
      storageKey: true,
      provider: true,
      prompt: true,
      createdAt: true,
      characterTemplateId: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // Map character names for display
  const characterMap = new Map<string, string>()
  const templates = await prisma.characterTemplate.findMany({
    where: { id: { in: characterIds } },
    select: { id: true, name: true },
  })
  for (const t of templates) characterMap.set(t.id, t.name)

  const result = portraits.map((p: { id: string; name: string; url: string; provider: string; prompt: string; createdAt: Date; characterTemplateId: string | null }) => ({
    id: p.id,
    name: p.name,
    url: p.url.startsWith("http") || p.url.startsWith("data:") ? p.url : `/api/images/${p.url}`,
    provider: p.provider,
    source: p.prompt.startsWith("Edit:") ? "AI Edit" : "AI Generated",
    createdAt: p.createdAt.toISOString(),
    characterName: p.characterTemplateId ? characterMap.get(p.characterTemplateId) ?? null : null,
    characterTemplateId: p.characterTemplateId,
  }))

  return NextResponse.json({ portraits: result })
}

/**
 * PATCH: Update a portrait's name.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = z.object({
    portraitId: z.string(),
    name: z.string().min(1).max(200),
  }).safeParse(body)

  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  // Verify ownership: portrait must belong to one of user's characters
  const portrait = await prisma.imageAsset.findUnique({
    where: { id: parsed.data.portraitId },
    select: { characterTemplateId: true },
  })
  if (!portrait?.characterTemplateId) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ownerCheck = await prisma.characterTemplate.findFirst({
    where: { id: portrait.characterTemplateId, userId: session.user.id },
  })
  if (!ownerCheck) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.imageAsset.update({
    where: { id: parsed.data.portraitId },
    data: { name: parsed.data.name },
  })

  return NextResponse.json({ ok: true })
}

/**
 * DELETE: Permanently delete a portrait from the library.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = z.object({ portraitId: z.string() }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  // Verify ownership
  const portrait = await prisma.imageAsset.findUnique({
    where: { id: parsed.data.portraitId },
    select: { characterTemplateId: true, storageKey: true },
  })
  if (!portrait?.characterTemplateId) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ownerCheck = await prisma.characterTemplate.findFirst({
    where: { id: portrait.characterTemplateId, userId: session.user.id },
  })
  if (!ownerCheck) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Unlink from any characters that use this portrait
  await prisma.characterTemplate.updateMany({
    where: { portraitAssetId: parsed.data.portraitId },
    data: { portraitAssetId: null },
  })

  // Delete the asset record
  await prisma.imageAsset.delete({ where: { id: parsed.data.portraitId } })

  // Optionally delete from R2
  const R2_CONFIGURED = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET)
  if (R2_CONFIGURED && portrait.storageKey.startsWith("portraits/")) {
    try {
      const { deleteFromR2 } = await import("@/lib/storage/r2")
      await deleteFromR2(portrait.storageKey)
    } catch { /* non-critical */ }
  }

  return new NextResponse(null, { status: 204 })
}
