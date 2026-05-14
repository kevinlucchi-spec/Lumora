import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const UpdateWorldSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  rules: z.record(z.string(), z.unknown()).optional(),
  toneGuide: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { worldId } = await params
  const world = await prisma.worldTemplate.findFirst({
    where: { id: worldId, userId: session.user.id, archivedAt: null },
    include: { instances: { include: { series: { select: { id: true, name: true } } } } },
  })
  if (!world) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(world)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { worldId } = await params
  const body = await req.json()
  const parsed = UpdateWorldSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { rules, toneGuide, ...rest } = parsed.data
  const data: Prisma.WorldTemplateUpdateInput = { ...rest }
  if (rules !== undefined) data.rules = rules as Prisma.InputJsonValue
  if (toneGuide !== undefined) data.toneGuide = toneGuide as Prisma.InputJsonValue

  const result = await prisma.worldTemplate.updateMany({
    where: { id: worldId, userId: session.user.id, archivedAt: null },
    data: data as never,
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.worldTemplate.findUnique({ where: { id: worldId } })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { worldId } = await params
  const result = await prisma.worldTemplate.updateMany({
    where: { id: worldId, userId: session.user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
