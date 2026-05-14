import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const UpdateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).optional(),
  essence: z.object({
    personality: z.string().optional(),
    appearance: z.string().optional(),
    voiceTone: z.string().optional(),
    age: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { characterId } = await params
  const character = await prisma.characterTemplate.findFirst({
    where: { id: characterId, userId: session.user.id, archivedAt: null },
    include: { instances: { include: { series: { select: { id: true, name: true } } } } },
  })
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(character)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { characterId } = await params
  const body = await req.json()
  const parsed = UpdateCharacterSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const character = await prisma.characterTemplate.updateMany({
    where: { id: characterId, userId: session.user.id, archivedAt: null },
    data: parsed.data as never,
  })
  if (character.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.characterTemplate.findUnique({ where: { id: characterId } })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { characterId } = await params
  const result = await prisma.characterTemplate.updateMany({
    where: { id: characterId, userId: session.user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
