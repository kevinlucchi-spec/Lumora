import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const CreateBranchSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  parentBranchId: z.string().optional(),
  forkFromStoryId: z.string().optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params

  // Verify series ownership
  const series = await prisma.series.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const branches = await prisma.branch.findMany({
    where: { seriesId, archivedAt: null },
    include: {
      volumes: { include: { stories: { select: { id: true, title: true, order: true } } } },
      branchMemory: true,
    },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(branches)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params

  const series = await prisma.series.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 })

  const body = await req.json()
  const parsed = CreateBranchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // If forking from a story, verify it exists in this series
  if (parsed.data.forkFromStoryId) {
    const story = await prisma.story.findFirst({
      where: {
        id: parsed.data.forkFromStoryId,
        volume: { branch: { seriesId } },
      },
    })
    if (!story) return NextResponse.json({ error: "Fork source story not found in this series" }, { status: 400 })
  }

  const branch = await prisma.branch.create({
    data: {
      seriesId,
      name: parsed.data.name,
      description: parsed.data.description,
      parentBranchId: parsed.data.parentBranchId,
      forkFromStoryId: parsed.data.forkFromStoryId,
      isCanon: false, // Forked branches are non-canon by default
      volumes: {
        create: { name: "Volume 1", order: 1 },
      },
      branchMemory: {
        create: { facts: {}, eventLog: [] },
      },
    },
    include: { volumes: true, branchMemory: true },
  })

  return NextResponse.json(branch, { status: 201 })
}
