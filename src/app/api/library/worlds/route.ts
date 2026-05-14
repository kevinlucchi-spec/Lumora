import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const CreateWorldSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  rules: z.record(z.string(), z.unknown()).default({}),
  toneGuide: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const worlds = await prisma.worldTemplate.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json(worlds)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const parsed = CreateWorldSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { rules, toneGuide, ...rest } = parsed.data
  const world = await prisma.worldTemplate.create({
    data: {
      ...rest,
      rules: rules as Prisma.InputJsonValue,
      toneGuide: toneGuide as Prisma.InputJsonValue,
      userId: session.user.id,
    },
  })
  return NextResponse.json(world, { status: 201 })
}
