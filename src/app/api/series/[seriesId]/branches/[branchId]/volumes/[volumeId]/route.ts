// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const UpdateVolumeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  order: z.number().int().positive().optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string; branchId: string; volumeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId, branchId, volumeId } = await params

  const volume = await prisma.volume.findFirst({
    where: {
      id: volumeId,
      branchId,
      branch: { seriesId, series: { userId: session.user.id } },
      archivedAt: null,
    },
    include: {
      stories: { orderBy: { order: "asc" }, include: { sceneSpecs: true, imageAssets: true } },
    },
  })
  if (!volume) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(volume)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ seriesId: string; branchId: string; volumeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId, branchId, volumeId } = await params
  const body = await req.json()
  const parsed = UpdateVolumeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await prisma.volume.updateMany({
    where: {
      id: volumeId,
      branchId,
      branch: { seriesId, series: { userId: session.user.id } },
      archivedAt: null,
    },
    data: parsed.data,
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.volume.findUnique({ where: { id: volumeId } })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string; branchId: string; volumeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId, branchId, volumeId } = await params

  const result = await prisma.volume.updateMany({
    where: {
      id: volumeId,
      branchId,
      branch: { seriesId, series: { userId: session.user.id } },
      archivedAt: null,
    },
    data: { archivedAt: new Date() },
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
