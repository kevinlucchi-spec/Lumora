import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const UpdateArtStyleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  styleKeywords: z.array(z.string()).optional(),
  medium: z.string().optional(),
  colorPalette: z.string().optional(),
  negativeTerms: z.array(z.string()).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ artStyleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { artStyleId } = await params
  const style = await prisma.artStylePreset.findFirst({
    where: { id: artStyleId, userId: session.user.id, archivedAt: null },
  })
  if (!style) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(style)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ artStyleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { artStyleId } = await params
  const body = await req.json()
  const parsed = UpdateArtStyleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const result = await prisma.artStylePreset.updateMany({
    where: { id: artStyleId, userId: session.user.id, archivedAt: null },
    data: parsed.data as never,
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.artStylePreset.findUnique({ where: { id: artStyleId } })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ artStyleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { artStyleId } = await params
  const result = await prisma.artStylePreset.updateMany({
    where: { id: artStyleId, userId: session.user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
