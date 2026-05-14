// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET: Export a story as a simple HTML-to-PDF download.
 * Uses the browser's print-to-PDF capability via a styled HTML page.
 * Returns an HTML page that auto-triggers print dialog.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string; storyId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const { seriesId, storyId } = await params

  const story = await prisma.story.findFirst({
    where: { id: storyId, volume: { branch: { seriesId } } },
    include: {
      imageAssets: { select: { url: true, sceneSpecId: true } },
      sceneSpecs: { select: { id: true, order: true }, orderBy: { order: "asc" } },
      volume: { include: { branch: { include: { series: { select: { name: true, userId: true } } } } } },
    },
  })

  if (!story || story.volume.branch.series.userId !== session.user.id) {
    return new Response("Not found", { status: 404 })
  }

  const pages = story.content as Array<{ pageNumber: number; text: string }>

  // Map images by scene spec for distribution
  const imageBySceneId = new Map(story.imageAssets.map((a: { sceneSpecId: string | null; url: string }) => [a.sceneSpecId, a.url]))
  const images = story.sceneSpecs
    .map((spec: { id: string }) => imageBySceneId.get(spec.id))
    .filter(Boolean) as string[]

  // Distribute images evenly
  const imagePositions = new Map<number, string>()
  if (images.length > 0 && pages.length > 0) {
    const spacing = pages.length / (images.length + 1)
    images.forEach((url, idx) => {
      const pageIdx = Math.min(Math.floor(spacing * (idx + 1)) - 1, pages.length - 2)
      const resolvedUrl = url.startsWith("http") || url.startsWith("data:") ? url : `/api/images/${url}`
      imagePositions.set(Math.max(0, pageIdx), resolvedUrl)
    })
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(story.title)} — Lumora</title>
  <style>
    @page { margin: 1in; size: letter; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a2e; line-height: 1.8; max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 28px; text-align: center; margin-bottom: 8px; color: #1a1a2e; }
    .series-name { text-align: center; color: #666; font-size: 14px; margin-bottom: 40px; }
    .meta { text-align: center; color: #999; font-size: 12px; margin-bottom: 40px; }
    .page-text { font-size: 16px; margin-bottom: 24px; text-indent: 24px; }
    .page-text:first-of-type { text-indent: 0; }
    .page-text:first-of-type::first-letter { font-size: 48px; float: left; line-height: 1; margin-right: 8px; color: #4f46e5; font-weight: bold; }
    .page-text:last-of-type { font-style: italic; color: #444; }
    .illustration { width: 100%; max-width: 500px; display: block; margin: 32px auto; border-radius: 12px; }
    .divider { text-align: center; color: #ddd; margin: 20px 0; font-size: 12px; }
    .footer { text-align: center; color: #aaa; font-size: 11px; margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(story.title)}</h1>
  <p class="series-name">${escapeHtml(story.volume.branch.series.name)}</p>
  <p class="meta">${story.wordCount ? `${story.wordCount} words` : ""} ${story.readingTimeMin ? `· ~${story.readingTimeMin} min read` : ""}</p>

  ${pages.map((page, i) => {
    const img = imagePositions.get(i)
    return `<p class="page-text">${escapeHtml(page.text)}</p>${img ? `<img class="illustration" src="${img}" alt="Illustration">` : ""}${i < pages.length - 1 && !img ? '<p class="divider">·</p>' : ""}`
  }).join("\n  ")}

  <p class="footer">Generated with Lumora</p>

  <script class="no-print">window.onload = function() { window.print(); }</script>
</body>
</html>`

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  })
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
