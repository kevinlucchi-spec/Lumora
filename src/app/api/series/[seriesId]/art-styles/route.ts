// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const LinkSchema = z.object({ artStylePresetId: z.string().min(1) })

export async function GET(_req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params
  const links = await prisma.seriesArtStyleLink.findMany({
    where: { seriesId, series: { userId: session.user.id } },
    include: { artStylePreset: { select: { id: true, name: true, medium: true, styleKeywords: true } } },
  })
  return NextResponse.json(links.map((l: { artStylePreset: unknown }) => l.artStylePreset))
}

export async function POST(req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params
  const series = await prisma.series.findFirst({ where: { id: seriesId, userId: session.user.id, archivedAt: null } })
  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const body = await req.json()
  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    await prisma.seriesArtStyleLink.create({ data: { seriesId, artStylePresetId: parsed.data.artStylePresetId } })
  } catch { return NextResponse.json({ error: "Already linked" }, { status: 409 }) }
  return NextResponse.json({ linked: true }, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params
  const { artStylePresetId } = await req.json()
  await prisma.seriesArtStyleLink.deleteMany({ where: { seriesId, artStylePresetId, series: { userId: session.user.id } } })
  return new NextResponse(null, { status: 204 })
}
