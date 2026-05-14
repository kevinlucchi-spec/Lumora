import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * PATCH: Update story fields (currently: title).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ seriesId: string; storyId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { seriesId, storyId } = await params
  const body = await req.json()

  const story = await prisma.story.findFirst({
    where: {
      id: storyId,
      archivedAt: null,
      volume: { branch: { seriesId, series: { userId: session.user.id } } },
    },
    select: { id: true },
  })
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const title = body?.title
  if (!title || typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 })
  }

  await prisma.story.update({
    where: { id: storyId },
    data: { title: title.trim() },
  })

  return NextResponse.json({ ok: true })
}

/**
 * DELETE: Soft-delete (archive) a story.
 * Sets archivedAt timestamp. The story is hidden but not permanently removed.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string; storyId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { seriesId, storyId } = await params

  // Verify ownership through series chain
  const story = await prisma.story.findFirst({
    where: {
      id: storyId,
      archivedAt: null,
      volume: { branch: { seriesId, series: { userId: session.user.id } } },
    },
    select: { id: true },
  })

  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.story.update({
    where: { id: storyId },
    data: { archivedAt: new Date() },
  })

  return new NextResponse(null, { status: 204 })
}
