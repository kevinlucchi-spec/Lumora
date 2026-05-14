// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { extractPortraitFromScene } from "@/lib/services/portrait-extract"

/**
 * POST: Extract a portrait from a scene image containing this character.
 * Body: { sceneImageUrl: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId } = await params
  const body = await req.json()
  const { sceneImageUrl } = body

  if (!sceneImageUrl) return NextResponse.json({ error: "sceneImageUrl required" }, { status: 400 })

  const character = await prisma.characterTemplate.findFirst({
    where: { id: characterId, userId: session.user.id },
    select: { name: true, essence: true },
  })
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 })

  const essence = character.essence as Record<string, unknown>
  const appearance = (essence.appearance as string) ?? character.name

  const result = await extractPortraitFromScene(
    character.name,
    appearance,
    sceneImageUrl,
    characterId,
  )

  if (!result) return NextResponse.json({ error: "Portrait extraction failed" }, { status: 500 })

  return NextResponse.json(result, { status: 201 })
}
