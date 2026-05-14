import { getAIRouter } from "@/lib/providers/ai"
import { downloadAndUpload, getSignedReadUrl } from "@/lib/storage/r2"
import { prisma } from "@/lib/prisma"
import sharp from "sharp"

const R2_CONFIGURED = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET)

/**
 * Extract a character portrait by cropping them from a scene image.
 * Uses GPT-4o vision to locate the character, then sharp to crop.
 */
export async function extractPortraitFromScene(
  characterName: string,
  characterAppearance: string,
  sceneImageUrl: string,
  characterTemplateId: string,
): Promise<{ imageAssetId: string; url: string } | null> {
  // Resolve the scene image URL
  let resolvedUrl = sceneImageUrl
  if (!sceneImageUrl.startsWith("http") && !sceneImageUrl.startsWith("data:")) {
    try {
      resolvedUrl = await getSignedReadUrl(sceneImageUrl, 300)
    } catch {
      return null
    }
  }

  // Download the scene image
  let imageBuffer: Buffer
  try {
    if (resolvedUrl.startsWith("data:")) {
      const match = resolvedUrl.match(/^data:[^;]+;base64,(.+)$/)
      if (!match) return null
      imageBuffer = Buffer.from(match[1], "base64")
    } else {
      const res = await fetch(resolvedUrl)
      if (!res.ok) return null
      imageBuffer = Buffer.from(await res.arrayBuffer())
    }
  } catch {
    return null
  }

  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata()
  const imgWidth = metadata.width ?? 1024
  const imgHeight = metadata.height ?? 1024

  // Ask GPT-4o to locate the character with bounding box coordinates
  const router = getAIRouter()
  let bbox: { x: number; y: number; width: number; height: number }

  try {
    const response = await router.call({
      capability: "qa:image-scene",
      systemPrompt: `You locate characters in illustrated scenes. Given a character name and description, find them in the image and return their bounding box as pixel coordinates.

Return ONLY valid JSON: { "x": <left edge>, "y": <top edge>, "width": <box width>, "height": <box height>, "found": true }

The image is ${imgWidth}x${imgHeight} pixels. Return coordinates in pixels.

FRAMING RULES:
- Include the character's ENTIRE head and full torso at minimum
- Add generous padding — at least 20% extra space on all sides beyond the character's body
- WIDER is better than too tight. It's a portrait, not a face crop.
- If the character takes up less than 40% of the image, your bounding box should be at least 50% of the image dimensions
- If the character is not found, return { "found": false }`,
      userPrompt: `Find "${characterName}" in this image. Description: ${characterAppearance}. Return their bounding box coordinates.`,
      imageUrls: [resolvedUrl],
      temperature: 0.1,
    })

    const raw = response.rawText.trim()
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw
    const start = jsonStr.indexOf("{")
    const end = jsonStr.lastIndexOf("}")
    const parsed = JSON.parse(start >= 0 && end > start ? jsonStr.slice(start, end + 1) : jsonStr)

    if (!parsed.found) return null

    // Start with the AI's coordinates
    let bx = Math.floor(parsed.x)
    let by = Math.floor(parsed.y)
    let bw = Math.floor(parsed.width)
    let bh = Math.floor(parsed.height)

    // Add 25% padding on all sides
    const padX = Math.floor(bw * 0.25)
    const padY = Math.floor(bh * 0.25)
    bx = Math.max(0, bx - padX)
    by = Math.max(0, by - padY)
    bw = Math.min(bw + padX * 2, imgWidth - bx)
    bh = Math.min(bh + padY * 2, imgHeight - by)

    // Enforce minimum size — at least 30% of image in each dimension
    const minW = Math.floor(imgWidth * 0.3)
    const minH = Math.floor(imgHeight * 0.3)
    if (bw < minW) {
      const diff = minW - bw
      bx = Math.max(0, bx - Math.floor(diff / 2))
      bw = Math.min(minW, imgWidth - bx)
    }
    if (bh < minH) {
      const diff = minH - bh
      by = Math.max(0, by - Math.floor(diff / 2))
      bh = Math.min(minH, imgHeight - by)
    }

    bbox = { x: bx, y: by, width: bw, height: bh }

    // Sanity check
    if (bbox.width < 50 || bbox.height < 50) return null
  } catch {
    return null
  }

  // Crop the image
  try {
    const cropped = await sharp(imageBuffer)
      .extract({ left: bbox.x, top: bbox.y, width: bbox.width, height: bbox.height })
      .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()

    let finalUrl: string
    let finalStorageKey: string
    const storageKey = `portraits/${characterTemplateId}/${Date.now()}.png`

    if (R2_CONFIGURED) {
      try {
        const { uploadToR2 } = await import("@/lib/storage/r2")
        await uploadToR2(storageKey, cropped, "image/png")
        finalUrl = storageKey
        finalStorageKey = storageKey
      } catch {
        const base64 = cropped.toString("base64")
        finalUrl = `data:image/png;base64,${base64}`
        finalStorageKey = storageKey
      }
    } else {
      const base64 = cropped.toString("base64")
      finalUrl = `data:image/png;base64,${base64}`
      finalStorageKey = storageKey
    }

    const template = await prisma.characterTemplate.findUnique({
      where: { id: characterTemplateId },
      select: { name: true },
    })

    const imageAsset = await prisma.imageAsset.create({
      data: {
        name: `${template?.name ?? characterName} Portrait`,
        assetType: "character_portrait",
        characterTemplateId,
        storageKey: finalStorageKey,
        url: finalUrl,
        prompt: `Cropped from scene image — ${characterName}`,
        provider: "crop",
        model: "sharp",
        width: 1024,
        height: 1024,
        metadata: { croppedFromScene: true, bbox },
      },
    })

    await prisma.characterTemplate.update({
      where: { id: characterTemplateId },
      data: { portraitAssetId: imageAsset.id },
    })

    const displayUrl = finalUrl.startsWith("http") || finalUrl.startsWith("data:")
      ? finalUrl
      : `/api/images/${finalUrl}`

    return { imageAssetId: imageAsset.id, url: displayUrl }
  } catch (err) {
    console.error(`[portrait-extract] Crop failed for ${characterName}:`, (err as Error).message)
    return null
  }
}
