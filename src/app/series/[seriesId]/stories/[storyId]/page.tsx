// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/prisma"
import type { StoryContent } from "@/lib/schemas/story"
import Link from "next/link"
import { StoryActions } from "./story-actions"
import { EditableTitle } from "./editable-title"
import { NewElementsPrompt } from "./new-elements-prompt"
import { ReadAloud } from "./read-aloud"

export default async function StoryReaderPage({
  params,
}: {
  params: Promise<{ seriesId: string; storyId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { seriesId, storyId } = await params

  let story: {
    id: string
    title: string
    content: unknown
    mode: string
    ageBand: string
    readingTimeMin: number | null
    wordCount: number | null
    createdAt: Date
    imageAssets: { id: string; url: string; sceneSpecId: string | null }[]
    sceneSpecs: { id: string; order: number; imagePrompt: string | null }[]
    generationRun: { finalOutput: unknown } | null
    volume: {
      branch: {
        name: string
        seriesId: string
        series: { name: string; userId: string }
      }
    }
  } | null = null

  try {
    story = await prisma.story.findFirst({
      where: {
        id: storyId,
        volume: { branch: { seriesId } },
      },
      include: {
        imageAssets: { select: { id: true, url: true, sceneSpecId: true } },
        sceneSpecs: { select: { id: true, order: true, imagePrompt: true }, orderBy: { order: "asc" } },
        generationRun: { select: { finalOutput: true } },
        volume: {
          include: {
            branch: {
              include: { series: { select: { name: true, userId: true } } },
            },
          },
        },
      },
    })
  } catch {
    // DB not connected
  }

  if (!story) notFound()
  if (story.volume.branch.series.userId !== session.user.id) notFound()

  const pages = story.content as StoryContent
  const imageBySceneId = new Map(story.imageAssets.map((a) => {
    // If the URL looks like a storage key (not http/data URL), route through the image proxy
    const url = a.url.startsWith("http") || a.url.startsWith("data:")
      ? a.url
      : `/api/images/${a.url}`
    return [a.sceneSpecId, url]
  }))

  const modeLabel: Record<string, string> = {
    CALM_BEDTIME: "Calm bedtime",
    COZY_ADVENTURE: "Cozy adventure",
    MORAL_LESSON: "Moral lesson",
    DREAMLIKE: "Dreamlike",
    SIBLING_FAMILY: "Sibling & family",
    WHAT_IF_BRANCH: "What if…",
    CUSTOM: "Custom",
  }

  const ageBandLabel: Record<string, string> = {
    TODDLER: "Toddler",
    EARLY: "Early",
    MIDDLE: "Middle",
    TWEEN: "Tween",
    PRETEEN: "Preteen",
  }

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-8 py-10 max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-8">
          <Link href="/series" className="hover:text-white transition-colors">Series</Link>
          <span>/</span>
          <Link href={`/series/${seriesId}`} className="hover:text-white transition-colors">
            {story.volume.branch.series.name}
          </Link>
          <span>/</span>
          <span className="text-white/70 truncate">{story.title}</span>
        </div>

        {/* Story header */}
        <div className="mb-10">
          <div className="mb-4">
            <EditableTitle storyId={storyId} seriesId={seriesId} initialTitle={story.title} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-white/40">
            <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
              {modeLabel[story.mode] ?? story.mode}
            </span>
            <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
              {ageBandLabel[story.ageBand] ?? story.ageBand}
            </span>
            {story.readingTimeMin && (
              <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                {story.readingTimeMin} min read
              </span>
            )}
            {story.wordCount && (
              <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                {story.wordCount.toLocaleString()} words
              </span>
            )}
          </div>
        </div>

        {/* Read aloud — above the story */}
        <ReadAloud seriesId={seriesId} storyId={storyId} pageCount={Array.isArray(pages) ? pages.length : 0} />

        {/* Pages — images distributed evenly through the story */}
        <div className="space-y-8">
          {(() => {
            if (!Array.isArray(pages)) return null

            // Collect all available images
            const images = story.sceneSpecs
              .map((spec) => ({ id: spec.id, url: imageBySceneId.get(spec.id), prompt: spec.imagePrompt }))
              .filter((img) => img.url)

            // Calculate where to place images: spread evenly through the pages
            const imagePositions = new Map<number, { url: string; prompt: string | null }>()
            if (images.length > 0 && pages.length > 0) {
              if (images.length === 1) {
                // Single image: place after first ~third of the story
                imagePositions.set(Math.max(0, Math.floor(pages.length / 3) - 1), { url: images[0].url!, prompt: images[0].prompt })
              } else {
                // Multiple images: spread evenly, first image after opening, last before ending
                const spacing = pages.length / (images.length + 1)
                images.forEach((img, idx) => {
                  const pageIdx = Math.min(Math.floor(spacing * (idx + 1)) - 1, pages.length - 2)
                  imagePositions.set(Math.max(0, pageIdx), { url: img.url!, prompt: img.prompt })
                })
              }
            }

            return pages.map((page, i) => {
              const imageAfter = imagePositions.get(i)
              const isFirst = i === 0
              const isLast = i === pages.length - 1

              return (
                <div key={page.pageNumber ?? i} data-page-index={i}>
                  {/* Opening page gets special treatment */}
                  <p className={`text-white/90 leading-relaxed ${
                    isFirst ? "text-xl first-letter:text-4xl first-letter:font-serif first-letter:text-indigo-300 first-letter:float-left first-letter:mr-2 first-letter:mt-1" :
                    isLast ? "text-lg italic text-white/70" :
                    "text-lg"
                  }`}>
                    {page.text}
                  </p>

                  {/* Image placed after this page */}
                  {imageAfter && (
                    <div className="my-8 rounded-2xl overflow-hidden border border-white/10 shadow-lg shadow-black/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageAfter.url}
                        alt={imageAfter.prompt ?? `Illustration`}
                        className="w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Page divider — only between text blocks, not after images */}
                  {!isLast && !imageAfter && (
                    <div className="flex items-center gap-3 mt-6">
                      <div className="flex-1 h-px bg-white/5" />
                      <span className="text-white/15 text-xs">·</span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>

        {/* New elements prompt — save story-generated characters */}
        {await (async () => {
          const finalOutput = story.generationRun?.finalOutput as { supportingCharacters?: Array<Record<string, string>> } | null
          const supportingChars = finalOutput?.supportingCharacters ?? []
          if (supportingChars.length === 0) return null
          const existingChars = await prisma.characterTemplate.findMany({
            where: { userId: session.user!.id!, archivedAt: null },
            select: { name: true },
          }).catch(() => [])
          const allSaved = supportingChars.every((sc) =>
            existingChars.some((ec) => ec.name.toLowerCase() === (sc.name ?? "").toLowerCase())
          )
          if (allSaved) return null
          return (
            <NewElementsPrompt
              seriesId={seriesId}
              storyId={storyId}
              supportingCharacters={supportingChars as never}
              existingCharacterNames={existingChars.map((c) => c.name)}
            />
          )
        })()}

        {/* Footer with actions */}
        <StoryActions seriesId={seriesId} storyId={storyId} storyTitle={story.title} />
      </div>
    </AppShell>
  )
}
