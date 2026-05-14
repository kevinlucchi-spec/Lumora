// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/compose
 * Returns all composable assets for the current user.
 * Used by the story generation form to populate selection options.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  const [characters, worlds, artStyles, promptSeeds] = await Promise.all([
    prisma.characterTemplate.findMany({
      where: { userId, archivedAt: null },
      select: { id: true, name: true, description: true, portraitAssetId: true },
      orderBy: { name: "asc" },
    }),
    prisma.worldTemplate.findMany({
      where: { userId, archivedAt: null },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    }),
    prisma.artStylePreset.findMany({
      where: { userId, archivedAt: null },
      select: { id: true, name: true, description: true, styleKeywords: true, medium: true },
      orderBy: { name: "asc" },
    }),
    prisma.storyPromptSeed.findMany({
      where: { userId, archivedAt: null },
      select: { id: true, name: true, prompt: true, themes: true, suggestedModes: true },
      orderBy: { name: "asc" },
    }),
  ])

  return NextResponse.json({ characters, worlds, artStyles, promptSeeds })
}
