// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const CreatePromptSeedSchema = z.object({
  name: z.string().min(1).max(200),
  prompt: z.string().min(10).max(2000),
  themes: z.array(z.string()).default([]),
  suggestedModes: z.array(z.enum([
    "CALM_BEDTIME", "COZY_ADVENTURE", "MORAL_LESSON", "DREAMLIKE",
    "SIBLING_FAMILY", "WHAT_IF_BRANCH", "CUSTOM",
  ])).default([]),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const seeds = await prisma.storyPromptSeed.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json(seeds)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const parsed = CreatePromptSeedSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const seed = await prisma.storyPromptSeed.create({
    data: { ...parsed.data, userId: session.user.id },
  })
  return NextResponse.json(seed, { status: 201 })
}
