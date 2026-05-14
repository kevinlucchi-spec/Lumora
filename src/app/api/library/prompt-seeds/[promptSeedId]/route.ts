import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const UpdatePromptSeedSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  prompt: z.string().min(10).max(2000).optional(),
  themes: z.array(z.string()).optional(),
  suggestedModes: z.array(z.enum([
    "CALM_BEDTIME", "COZY_ADVENTURE", "MORAL_LESSON", "DREAMLIKE",
    "SIBLING_FAMILY", "WHAT_IF_BRANCH", "CUSTOM",
  ])).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ promptSeedId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { promptSeedId } = await params
  const seed = await prisma.storyPromptSeed.findFirst({
    where: { id: promptSeedId, userId: session.user.id, archivedAt: null },
  })
  if (!seed) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(seed)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ promptSeedId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { promptSeedId } = await params
  const body = await req.json()
  const parsed = UpdatePromptSeedSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const result = await prisma.storyPromptSeed.updateMany({
    where: { id: promptSeedId, userId: session.user.id, archivedAt: null },
    data: parsed.data as never,
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.storyPromptSeed.findUnique({ where: { id: promptSeedId } })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ promptSeedId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { promptSeedId } = await params
  const result = await prisma.storyPromptSeed.updateMany({
    where: { id: promptSeedId, userId: session.user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
