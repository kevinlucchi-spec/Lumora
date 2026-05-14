// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const LinkSchema = z.object({ worldTemplateId: z.string().min(1) })

export async function GET(_req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params
  const links = await prisma.seriesWorldLink.findMany({
    where: { seriesId, series: { userId: session.user.id } },
    include: { worldTemplate: { select: { id: true, name: true, description: true } } },
  })
  return NextResponse.json(links.map((l: { worldTemplate: unknown }) => l.worldTemplate))
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
    await prisma.seriesWorldLink.create({ data: { seriesId, worldTemplateId: parsed.data.worldTemplateId } })
  } catch { return NextResponse.json({ error: "Already linked" }, { status: 409 }) }
  return NextResponse.json({ linked: true }, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params
  const { worldTemplateId } = await req.json()
  await prisma.seriesWorldLink.deleteMany({ where: { seriesId, worldTemplateId, series: { userId: session.user.id } } })
  return new NextResponse(null, { status: 204 })
}
