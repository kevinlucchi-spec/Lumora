// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const CreateCharacterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  essence: z.object({
    personality: z.string().max(500).optional(),
    appearance: z.string().max(500).optional(),
    voiceTone: z.string().max(300).optional(),
    age: z.string().max(100).optional(),
  }),
  visualProfile: z.object({
    physicalDescription: z.object({
      height: z.string().optional(),
      build: z.string().optional(),
      hairColor: z.string().optional(),
      hairStyle: z.string().optional(),
      eyeColor: z.string().optional(),
      skinTone: z.string().optional(),
      age: z.string().optional(),
      species: z.string().default("human"),
    }),
    clothingDefaults: z.object({
      outfit: z.string().optional(),
      accessories: z.array(z.string()).default([]),
      colors: z.array(z.string()).default([]),
    }).optional(),
    distinguishingFeatures: z.array(z.string()).default([]),
    artStyleNotes: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).default([]),
  sharePolicy: z.enum(["PRIVATE", "UNLISTED", "PUBLIC_VIEW", "PUBLIC_REUSE"]).default("PRIVATE"),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const characters = await prisma.characterTemplate.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json(characters)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const parsed = CreateCharacterSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const character = await prisma.characterTemplate.create({
    data: { ...parsed.data, userId: session.user.id },
  })
  return NextResponse.json(character, { status: 201 })
}
