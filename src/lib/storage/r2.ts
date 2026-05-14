// @ts-nocheck
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

let _client: S3Client | null = null

function getClient(): S3Client {
  if (_client) return _client

  const endpoint = process.env.S3_ENDPOINT
  const region = process.env.S3_REGION ?? "auto"
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2/S3 storage is not configured — set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY")
  }

  _client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
  return _client
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET
  if (!bucket) throw new Error("S3_BUCKET is not configured")
  return bucket
}

/**
 * Upload a buffer (e.g. a downloaded image) to R2.
 * Returns the storage key used.
 */
export async function uploadToR2(
  storageKey: string,
  body: Buffer | Uint8Array,
  contentType: string = "image/png",
): Promise<string> {
  const client = getClient()
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
      Body: body,
      ContentType: contentType,
    }),
  )
  return storageKey
}

/**
 * Get a signed URL for reading a private object.
 * Default expiry: 1 hour.
 */
export async function getSignedReadUrl(storageKey: string, expiresIn = 3600): Promise<string> {
  const client = getClient()
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getBucket(), Key: storageKey }),
    { expiresIn },
  )
}

/**
 * Get the public URL for an object (if the bucket has public access enabled).
 */
export function getPublicUrl(storageKey: string): string {
  const endpoint = process.env.S3_ENDPOINT ?? ""
  const bucket = getBucket()
  // R2 public URL pattern: https://<bucket>.<accountId>.r2.dev/<key>
  // But if using a custom domain, use the endpoint directly
  return `${endpoint}/${bucket}/${storageKey}`
}

/**
 * Delete an object from R2.
 */
export async function deleteFromR2(storageKey: string): Promise<void> {
  const client = getClient()
  await client.send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: storageKey }),
  )
}

/**
 * Download an image from a URL (or decode a base64 data URL) and upload it to R2.
 * Handles both HTTP URLs (DALL-E) and data:image/... base64 URLs (Imagen).
 * Returns the storage key.
 */
export async function downloadAndUpload(
  imageUrl: string,
  storageKey: string,
): Promise<string> {
  // Handle base64 data URLs (e.g. from Imagen which returns base64)
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new Error("Invalid data URL format")
    const contentType = match[1]
    const buffer = Buffer.from(match[2], "base64")
    return uploadToR2(storageKey, buffer, contentType)
  }

  // Handle HTTP URLs (e.g. from DALL-E)
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get("content-type") ?? "image/png"
  return uploadToR2(storageKey, buffer, contentType)
}
