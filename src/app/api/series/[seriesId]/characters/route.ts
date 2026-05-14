import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const AddCharacterSchema = z.object({
  characterTemplateId: z.string().min(1),
})

/**
 * POST /api/series/[seriesId]/characters
 * Add a global character template to this series context.
 * Creates a CharacterInstance binding (Option B model).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params

  // Verify series ownership
  const series = await prisma.series.findFirst({
    where: { id: seriesId, userId: session.user.id, archivedAt: null },
  })
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 })

  const body = await req.json()
  const parsed = AddCharacterSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verify character template exists and belongs to user
  const template = await prisma.characterTemplate.findFirst({
    where: { id: parsed.data.characterTemplateId, userId: session.user.id, archivedAt: null },
  })
  if (!template) return NextResponse.json({ error: "Character not found" }, { status: 404 })

  // Check if already linked
  const existing = await prisma.characterInstance.findUnique({
    where: {
      seriesId_characterTemplateId: {
        seriesId,
        characterTemplateId: template.id,
      },
    },
  })
  if (existing) return NextResponse.json({ error: "Character already in this series" }, { status: 409 })

  // Create the instance binding with empty memory
  const instance = await prisma.characterInstance.create({
    data: {
      seriesId,
      characterTemplateId: template.id,
      memoryState: {},
      characterMemory: {
        create: {
          stableFacts: {},
          evolvingState: {},
          eventLog: [],
        },
      },
    },
    include: { characterTemplate: { select: { name: true } } },
  })

  return NextResponse.json(instance, { status: 201 })
}

/**
 * GET /api/series/[seriesId]/characters
 * List all characters associated with this series.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params

  const series = await prisma.series.findFirst({
    where: { id: seriesId, userId: session.user.id, archivedAt: null },
  })
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 })

  const instances = await prisma.characterInstance.findMany({
    where: { seriesId, archivedAt: null },
    include: { characterTemplate: { select: { id: true, name: true, description: true } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(instances)
}
