// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { editImageWithGemini } from "@/lib/providers/image/gemini-edit"
import { uploadToR2 } from "@/lib/storage/r2"
import { z } from "zod"

const R2_CONFIGURED = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET)

const EditSchema = z.object({
  editInstruction: z.string().min(3).max(500),
})

/**
 * POST /api/library/characters/[characterId]/portrait/edit
 * Edit the existing portrait using Gemini's image editing.
 * Sends the current image + user's edit instruction to Gemini.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const googleKey = process.env.GOOGLE_AI_API_KEY
  if (!googleKey) {
    return NextResponse.json({ error: "Google AI API key not configured." }, { status: 500 })
  }

  const { characterId } = await params

  const body = await req.json()
  const parsed = EditSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Please describe what you'd like to change." }, { status: 400 })

  // Get current portrait
  const character = await prisma.characterTemplate.findFirst({
    where: { id: characterId, userId: session.user.id, archivedAt: null },
    select: { portraitAssetId: true, name: true },
  })
  if (!character?.portraitAssetId) {
    return NextResponse.json({ error: "No portrait to edit. Generate one first." }, { status: 400 })
  }

  const portrait = await prisma.imageAsset.findUnique({
    where: { id: character.portraitAssetId },
    select: { url: true, storageKey: true },
  })
  if (!portrait) {
    return NextResponse.json({ error: "Portrait not found." }, { status: 404 })
  }

  try {
    // Get the current image as base64
    let imageBase64: string
    let mimeType = "image/png"

    if (portrait.url.startsWith("data:")) {
      // Already a data URL
      const match = portrait.url.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) throw new Error("Invalid portrait data")
      mimeType = match[1]
      imageBase64 = match[2]
    } else if (portrait.url.startsWith("http")) {
      // Remote URL — download it
      const imgRes = await fetch(portrait.url)
      if (!imgRes.ok) throw new Error("Could not fetch current portrait")
      const buffer = Buffer.from(await imgRes.arrayBuffer())
      imageBase64 = buffer.toString("base64")
      mimeType = imgRes.headers.get("content-type") ?? "image/png"
    } else if (R2_CONFIGURED) {
      // R2 storage key — fetch via signed URL
      const { getSignedReadUrl } = await import("@/lib/storage/r2")
      const signedUrl = await getSignedReadUrl(portrait.url, 60)
      const imgRes = await fetch(signedUrl)
      if (!imgRes.ok) throw new Error("Could not fetch portrait from storage")
      const buffer = Buffer.from(await imgRes.arrayBuffer())
      imageBase64 = buffer.toString("base64")
      mimeType = imgRes.headers.get("content-type") ?? "image/png"
    } else {
      throw new Error("Cannot access current portrait for editing")
    }

    // Try Gemini first, fall back to GPT Image edit
    let result
    try {
      result = await editImageWithGemini(googleKey, {
        imageBase64,
        mimeType,
        editInstruction: parsed.data.editInstruction,
      })
    } catch (geminiErr) {
      console.warn("[portrait-edit] Gemini failed, trying GPT Image:", (geminiErr as Error).message)
      const OpenAI = (await import("openai")).default
      const { toFile } = await import("openai")
      const openaiKey = process.env.OPENAI_API_KEY
      if (!openaiKey) throw geminiErr
      const client = new OpenAI({ apiKey: openaiKey })
      const imageBuffer = Buffer.from(imageBase64, "base64")
      const file = await toFile(imageBuffer, "portrait.png", { type: "image/png" })
      const response = await client.images.edit({
        model: "gpt-image-1",
        image: [file],
        prompt: `Edit this character portrait: ${parsed.data.editInstruction}. Keep the same character, art style, and composition. Only change what was requested.`,
        n: 1,
        size: "1024x1024",
      })
      const b64 = response.data?.[0]?.b64_json
      if (!b64) throw new Error("GPT Image edit returned no image")
      result = { imageBase64: b64, mimeType: "image/png" }
    }

    // Save the edited image
    const editedDataUrl = `data:${result.mimeType};base64,${result.imageBase64}`
    let finalUrl = editedDataUrl
    let finalStorageKey = `portraits/${characterId}/edit-${Date.now()}.png`

    if (R2_CONFIGURED) {
      try {
        const buffer = Buffer.from(result.imageBase64, "base64")
        await uploadToR2(finalStorageKey, buffer, result.mimeType)
        finalUrl = finalStorageKey
      } catch {
        // Fall back to data URL
      }
    }

    // Count existing portraits for sequential naming
    const existingCount = await prisma.imageAsset.count({
      where: { assetType: "character_portrait", characterTemplateId: characterId },
    })
    const portraitName = `${character.name} Edit ${existingCount + 1}`

    // Create new image asset (derived version, does not overwrite original)
    const imageAsset = await prisma.imageAsset.create({
      data: {
        name: portraitName,
        assetType: "character_portrait",
        characterTemplateId: characterId,
        storageKey: finalStorageKey,
        url: finalUrl,
        prompt: `Edit: ${parsed.data.editInstruction}`,
        provider: "gemini",
        model: "gemini-2.5-flash-preview-image",
        width: 1024,
        height: 1024,
        metadata: { editInstruction: parsed.data.editInstruction },
      },
    })

    // Update character's portrait link
    await prisma.characterTemplate.update({
      where: { id: characterId },
      data: { portraitAssetId: imageAsset.id },
    })

    const displayUrl = finalUrl.startsWith("http") || finalUrl.startsWith("data:")
      ? finalUrl
      : `/api/images/${finalUrl}`

    return NextResponse.json({
      imageAssetId: imageAsset.id,
      url: displayUrl,
      name: portraitName,
    }, { status: 200 })
  } catch (err) {
    const message = (err as Error).message
    console.error(`[portrait-edit] Failed for ${characterId}:`, err)

    const isActionable = message.includes("paid") || message.includes("billing") || message.includes("quota")
    return NextResponse.json(
      { error: isActionable ? message : "Portrait edit failed. Try a different instruction." },
      { status: 500 }
    )
  }
}
