// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId } = await req.json()
  if (!characterId) return NextResponse.json({ error: "characterId required" }, { status: 400 })

  // Find the shared character
  const original = await prisma.characterTemplate.findFirst({
    where: {
      id: characterId,
      sharePolicy: "PUBLIC_REUSE",
    },
  })

  if (!original) return NextResponse.json({ error: "Character not found or not available for reuse" }, { status: 404 })

  // Don't copy your own character
  if (original.userId === session.user.id) {
    return NextResponse.json({ error: "This is already your character" }, { status: 400 })
  }

  // Create provenance record for attribution
  const provenance = await prisma.sharedAssetProvenance.create({
    data: {
      originalCreatorId: original.userId,
      originalAssetId: original.id,
      originalAssetType: "character",
      attributionRequired: true,
      remixAllowed: true,
    },
  })

  // Copy the character
  const copy = await prisma.characterTemplate.create({
    data: {
      userId: session.user.id,
      name: original.name,
      description: original.description,
      essence: original.essence,
      visualProfile: original.visualProfile,
      tags: original.tags,
      provenanceId: provenance.id,
    },
  })

  // Copy the portrait if it exists — duplicate the actual image file
  if (original.portraitAssetId) {
    const portrait = await prisma.imageAsset.findUnique({ where: { id: original.portraitAssetId } })
    if (portrait) {
      let newStorageKey = portrait.storageKey
      let newUrl = portrait.url

      // Duplicate the image file in R2 so the copy is independent
      const R2_CONFIGURED = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET)
      if (R2_CONFIGURED && !portrait.url.startsWith("data:") && !portrait.url.startsWith("http")) {
        try {
          const { getSignedReadUrl, downloadAndUpload } = await import("@/lib/storage/r2")
          const signedUrl = await getSignedReadUrl(portrait.storageKey, 120)
          newStorageKey = `portraits/${copy.id}/${Date.now()}.png`
          await downloadAndUpload(signedUrl, newStorageKey)
          newUrl = newStorageKey
        } catch {
          // Fallback: reference the same file (better than no portrait)
        }
      }

      const newPortrait = await prisma.imageAsset.create({
        data: {
          name: `${original.name} Portrait (copy)`,
          assetType: "character_portrait",
          characterTemplateId: copy.id,
          storageKey: newStorageKey,
          url: newUrl,
          prompt: portrait.prompt,
          negativePrompt: portrait.negativePrompt,
          provider: portrait.provider,
          model: portrait.model,
          width: portrait.width,
          height: portrait.height,
          metadata: { copiedFrom: portrait.id },
        },
      })
      await prisma.characterTemplate.update({
        where: { id: copy.id },
        data: { portraitAssetId: newPortrait.id },
      })
    }
  }

  return NextResponse.json({ id: copy.id, name: copy.name }, { status: 201 })
}
