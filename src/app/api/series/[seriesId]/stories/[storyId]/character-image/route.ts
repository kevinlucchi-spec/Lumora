// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET: Find the best scene image featuring a character by name.
 * Returns the image proxy URL for use as a portrait.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; storyId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { storyId } = await params
  const name = req.nextUrl.searchParams.get("name")
  if (!name) return NextResponse.json({ error: "name parameter required" }, { status: 400 })

  // Find scene specs that mention this character
  const scenes = await prisma.sceneSpec.findMany({
    where: { storyId },
    include: { imageAsset: true },
    orderBy: { order: "asc" },
  })

  // Find the first scene that mentions the character and has an image
  const nameLower = name.toLowerCase()
  for (const scene of scenes) {
    const characters = scene.characters as string[]
    const mentioned = characters.some((c: string) => c.toLowerCase().includes(nameLower) || nameLower.includes(c.toLowerCase()))
    if (mentioned && scene.imageAsset) {
      const url = scene.imageAsset.url
      const imageUrl = url.startsWith("http") || url.startsWith("data:")
        ? url
        : `/api/images/${url}`
      return NextResponse.json({ imageUrl })
    }
  }

  // No scene image found for this character
  return NextResponse.json({ imageUrl: null })
}
