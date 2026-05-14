// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/prisma"
import type { StoryContent } from "@/lib/schemas/story"
import Link from "next/link"

export default async function SharedStoryPage({
  params,
}: {
  params: Promise<{ storyId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { storyId } = await params

  const story = await prisma.story.findFirst({
    where: {
      id: storyId,
      sharePolicy: { in: ["UNLISTED", "PUBLIC_VIEW", "PUBLIC_REUSE"] },
    },
    include: {
      imageAssets: { select: { id: true, url: true, sceneSpecId: true } },
      sceneSpecs: { select: { id: true, order: true, imagePrompt: true }, orderBy: { order: "asc" } },
      volume: {
        include: {
          branch: {
            include: { series: { select: { name: true, userId: true } } },
          },
        },
      },
    },
  })

  if (!story) notFound()

  const pages = story.content as StoryContent
  const isOwner = story.volume.branch.series.userId === session.user.id

  const imageBySceneId = new Map(story.imageAssets.map((a) => {
    const url = a.url.startsWith("http") || a.url.startsWith("data:")
      ? a.url
      : `/api/images/${a.url}`
    return [a.sceneSpecId, url]
  }))

  // Distribute images evenly
  const images = story.sceneSpecs
    .map((spec) => ({ id: spec.id, url: imageBySceneId.get(spec.id), prompt: spec.imagePrompt }))
    .filter((img) => img.url)

  const imagePositions = new Map()
  if (images.length > 0 && pages.length > 0) {
    if (images.length === 1) {
      imagePositions.set(Math.max(0, Math.floor(pages.length / 3) - 1), { url: images[0].url, prompt: images[0].prompt })
    } else {
      const spacing = pages.length / (images.length + 1)
      images.forEach((img, idx) => {
        const pageIdx = Math.min(Math.floor(spacing * (idx + 1)) - 1, pages.length - 2)
        imagePositions.set(Math.max(0, pageIdx), { url: img.url, prompt: img.prompt })
      })
    }
  }

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-2xl mx-auto overflow-x-hidden">
        <div className="flex items-center gap-2 text-sm text-white/40 mb-8">
          <Link href="/discover" className="hover:text-white transition-colors">Discover</Link>
          <span>/</span>
          <span className="text-white/70 break-words">{story.title}</span>
        </div>

        <div className="mb-10">
          <h1 className="text-2xl font-bold mb-2">{story.title}</h1>
          <p className="text-white/40 text-sm">
            From <span className="text-white/60">{story.volume.branch.series.name}</span>
            {isOwner && <span className="ml-2 text-indigo-400">(yours)</span>}
          </p>
        </div>

        <div className="space-y-8">
          {Array.isArray(pages) && pages.map((page, i) => {
            const imageAfter = imagePositions.get(i)
            const isFirst = i === 0
            const isLast = i === pages.length - 1

            return (
              <div key={page.pageNumber ?? i}>
                <p className={`text-white/90 leading-relaxed break-words ${
                  isFirst ? "text-xl first-letter:text-4xl first-letter:font-serif first-letter:text-indigo-300 first-letter:float-left first-letter:mr-2 first-letter:mt-1" :
                  isLast ? "text-lg italic text-white/70" :
                  "text-lg"
                }`}>
                  {page.text}
                </p>
                {imageAfter && (
                  <div className="my-8 rounded-2xl overflow-hidden border border-white/10 shadow-lg shadow-black/20">
                    <img src={imageAfter.url} alt={imageAfter.prompt ?? "Illustration"} className="w-full object-cover" />
                  </div>
                )}
                {!isLast && !imageAfter && (
                  <div className="flex items-center gap-3 mt-6">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-white/15 text-xs">·</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
