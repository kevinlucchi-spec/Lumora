import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const CreateArtStyleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  styleKeywords: z.array(z.string()).min(1),
  medium: z.string().optional(),
  colorPalette: z.string().optional(),
  negativeTerms: z.array(z.string()).default([]),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const styles = await prisma.artStylePreset.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json(styles)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const parsed = CreateArtStyleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const style = await prisma.artStylePreset.create({
    data: { ...parsed.data, userId: session.user.id },
  })
  return NextResponse.json(style, { status: 201 })
}
