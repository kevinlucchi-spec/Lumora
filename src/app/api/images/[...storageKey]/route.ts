// @ts-nocheck
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getSignedReadUrl } from "@/lib/storage/r2"

/**
 * Image proxy endpoint. Redirects to a signed R2 URL for the requested storage key.
 * Usage: /api/images/stories/run123/scene-1-123456.png
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ storageKey: string[] }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { storageKey } = await params
  const key = storageKey.join("/")

  try {
    const signedUrl = await getSignedReadUrl(key, 3600)
    return Response.redirect(signedUrl, 302)
  } catch {
    return new Response("Image not found", { status: 404 })
  }
}
