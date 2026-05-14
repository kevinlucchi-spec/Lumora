// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getImageProvider } from "@/lib/providers/image"
import { downloadAndUpload } from "@/lib/storage/r2"
import { visualProfileToPromptFragment, VisualProfileSchema } from "@/lib/schemas/visual-profile"

const R2_CONFIGURED = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET)

/**
 * POST: Generate a character portrait from the character's visual profile.
 * This is separate from story scene images — it establishes the canonical look.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId } = await params

  const character = await prisma.characterTemplate.findFirst({
    where: { id: characterId, userId: session.user.id, archivedAt: null },
  })
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Parse optional art style from request body
  let requestedArtStyle: string | undefined
  try {
    const body = await _req.json()
    requestedArtStyle = body?.artStyle
  } catch { /* no body or invalid json — use default */ }

  // Build portrait prompt from visual profile + essence
  const essence = character.essence as Record<string, unknown>
  const rawProfile = character.visualProfile
  let portraitDescription: string

  if (rawProfile) {
    const parsed = VisualProfileSchema.safeParse(rawProfile)
    if (parsed.success) {
      portraitDescription = visualProfileToPromptFragment(character.name, parsed.data)
    } else {
      portraitDescription = `${character.name}: ${essence.appearance ?? essence.personality ?? "a character"}`
    }
  } else {
    portraitDescription = `${character.name}: ${essence.appearance ?? essence.personality ?? "a character"}`
  }

  // Use requested art style, or fall back to series art style, or default
  let artStyleFragment = "Illustrated in a cozy, whimsical children's book style with soft colors and rounded forms."
  if (requestedArtStyle) {
    artStyleFragment = `Art style: ${requestedArtStyle}. Maintain this exact style.`
  } else {
    const instance = await prisma.characterInstance.findFirst({
      where: { characterTemplateId: characterId },
      select: { seriesId: true },
    })
    if (instance) {
      const artLink = await prisma.seriesArtStyleLink.findFirst({
        where: { seriesId: instance.seriesId },
        include: { artStylePreset: true },
      })
      if (artLink) {
        const keywords = artLink.artStylePreset.styleKeywords as string[]
        const medium = artLink.artStylePreset.medium
        artStyleFragment = `Art style: ${keywords.join(", ")}${medium ? `. Medium: ${medium}` : ""}. Maintain this exact style.`
      }
    }
  }

  const prompt = `Character portrait for a children's bedtime storybook. ${portraitDescription}. Soft, warm lighting. Gentle expression. Centered portrait composition, slight three-quarter view. ${artStyleFragment} No text. No background clutter — simple, warm gradient or soft bokeh background.`

  try {
    const imageProvider = getImageProvider()
    const result = await imageProvider.generate({
      prompt,
      negativePrompt: "scary, dark, violent, realistic photo, text, watermark, signature, extra fingers, distorted face",
      metadata: { assetType: "character_portrait", characterId },
    })

    let finalUrl = result.url
    let finalStorageKey = result.storageKey

    // Upload to R2 if configured
    if (R2_CONFIGURED && result.url) {
      try {
        const storageKey = `portraits/${characterId}/${Date.now()}.png`
        await downloadAndUpload(result.url, storageKey)
        finalStorageKey = storageKey
        finalUrl = storageKey
      } catch {
        // Fall back to ephemeral URL
      }
    }

    // Count existing portraits for this character to generate a sequential name
    const existingCount = await prisma.imageAsset.count({
      where: { assetType: "character_portrait", characterTemplateId: characterId },
    })
    const portraitName = `${character.name} Portrait ${existingCount + 1}`

    // Create the image asset
    const imageAsset = await prisma.imageAsset.create({
      data: {
        name: portraitName,
        assetType: "character_portrait",
        characterTemplateId: characterId,
        storageKey: finalStorageKey,
        url: finalUrl,
        prompt,
        negativePrompt: "scary, dark, violent, realistic photo, text, watermark",
        provider: result.provider,
        model: result.model,
        width: 1024,
        height: 1024,
        metadata: result.metadata as Record<string, string>,
      },
    })

    // Link portrait to character template
    await prisma.characterTemplate.update({
      where: { id: characterId },
      data: { portraitAssetId: imageAsset.id },
    })

    // Return the image URL for immediate display
    const displayUrl = finalUrl.startsWith("http") || finalUrl.startsWith("data:")
      ? finalUrl
      : `/api/images/${finalUrl}`

    return NextResponse.json({
      imageAssetId: imageAsset.id,
      url: displayUrl,
      name: portraitName,
      provider: result.provider,
    }, { status: 201 })
  } catch (err) {
    const message = (err as Error).message
    console.error(`[portrait] Generation failed for ${characterId}:`, err)

    // Surface actionable messages (like the paid fallback gate) directly to the user
    const isActionable = message.includes("ALLOW_PAID_IMAGE_FALLBACK") || message.includes("unavailable")
    return NextResponse.json(
      { error: isActionable ? message : "Portrait generation failed. Please try again." },
      { status: 500 }
    )
  }
}

/**
 * GET: Retrieve the current portrait for a character.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId } = await params

  const character = await prisma.characterTemplate.findFirst({
    where: { id: characterId, userId: session.user.id, archivedAt: null },
    select: { portraitAssetId: true },
  })
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!character.portraitAssetId) {
    return NextResponse.json({ portrait: null })
  }

  const portrait = await prisma.imageAsset.findUnique({
    where: { id: character.portraitAssetId },
    select: { id: true, url: true, storageKey: true, provider: true, createdAt: true },
  })

  if (!portrait) return NextResponse.json({ portrait: null })

  const displayUrl = portrait.url.startsWith("http") || portrait.url.startsWith("data:")
    ? portrait.url
    : `/api/images/${portrait.url}`

  return NextResponse.json({
    portrait: { ...portrait, url: displayUrl },
  })
}

/**
 * PUT: Assign an existing portrait from the library to this character.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId } = await params
  const body = await req.json()
  const portraitAssetId = body?.portraitAssetId

  if (!portraitAssetId || typeof portraitAssetId !== "string") {
    return NextResponse.json({ error: "Missing portraitAssetId" }, { status: 400 })
  }

  // Verify the portrait exists and belongs to the user
  const portrait = await prisma.imageAsset.findUnique({
    where: { id: portraitAssetId },
    select: { id: true, characterTemplateId: true },
  })
  if (!portrait?.characterTemplateId) {
    return NextResponse.json({ error: "Portrait not found" }, { status: 404 })
  }

  const ownerCheck = await prisma.characterTemplate.findFirst({
    where: { id: portrait.characterTemplateId, userId: session.user.id },
  })
  if (!ownerCheck) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Assign to this character
  await prisma.characterTemplate.updateMany({
    where: { id: characterId, userId: session.user.id, archivedAt: null },
    data: { portraitAssetId },
  })

  return NextResponse.json({ ok: true })
}

/**
 * DELETE: Remove the portrait (but keep the image asset for history).
 * Unlinks the portrait from the character template.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId } = await params

  await prisma.characterTemplate.updateMany({
    where: { id: characterId, userId: session.user.id, archivedAt: null },
    data: { portraitAssetId: null },
  })

  return new NextResponse(null, { status: 204 })
}
