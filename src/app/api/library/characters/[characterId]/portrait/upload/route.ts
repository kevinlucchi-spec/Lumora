// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadToR2 } from "@/lib/storage/r2"

const R2_CONFIGURED = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET)
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * POST: Upload a local image file as a character portrait.
 * Accepts multipart/form-data with a "file" field.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId } = await params

  const character = await prisma.characterTemplate.findFirst({
    where: { id: characterId, userId: session.user.id, archivedAt: null },
    select: { id: true, name: true },
  })
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB." }, { status: 400 })
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Use PNG, JPEG, WebP, or GIF." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1]
    const storageKey = `portraits/${characterId}/upload-${Date.now()}.${ext}`

    let finalUrl: string
    let finalStorageKey: string

    if (R2_CONFIGURED) {
      await uploadToR2(storageKey, buffer, file.type)
      finalUrl = storageKey
      finalStorageKey = storageKey
    } else {
      // Fall back to data URL
      const base64 = buffer.toString("base64")
      finalUrl = `data:${file.type};base64,${base64}`
      finalStorageKey = storageKey
    }

    // Count existing portraits for naming
    const existingCount = await prisma.imageAsset.count({
      where: { assetType: "character_portrait", characterTemplateId: characterId },
    })
    const portraitName = `${character.name} Upload ${existingCount + 1}`

    const imageAsset = await prisma.imageAsset.create({
      data: {
        name: portraitName,
        assetType: "character_portrait",
        characterTemplateId: characterId,
        storageKey: finalStorageKey,
        url: finalUrl,
        prompt: "User upload",
        provider: "upload",
        model: "user",
        width: null,
        height: null,
        metadata: { originalName: file.name, size: file.size, type: file.type },
      },
    })

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
    }, { status: 201 })
  } catch (err) {
    console.error(`[portrait-upload] Failed for ${characterId}:`, err)
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 })
  }
}
