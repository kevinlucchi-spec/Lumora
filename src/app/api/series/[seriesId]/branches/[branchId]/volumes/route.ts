// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const CreateVolumeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string; branchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId, branchId } = await params

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, seriesId, series: { userId: session.user.id } },
  })
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const volumes = await prisma.volume.findMany({
    where: { branchId, archivedAt: null },
    include: { stories: { select: { id: true, title: true, order: true }, orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  })
  return NextResponse.json(volumes)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ seriesId: string; branchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId, branchId } = await params

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, seriesId, series: { userId: session.user.id } },
  })
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

  const body = await req.json()
  const parsed = CreateVolumeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const maxOrder = await prisma.volume.aggregate({
    where: { branchId },
    _max: { order: true },
  })

  const volume = await prisma.volume.create({
    data: {
      branchId,
      name: parsed.data.name,
      description: parsed.data.description,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  })
  return NextResponse.json(volume, { status: 201 })
}
