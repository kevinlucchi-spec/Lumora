// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { getSeriesById } from "@/lib/services/series.service"
import { prisma } from "@/lib/prisma"
import { GenerateStoryForm } from "./generate-story-form"
import Link from "next/link"

export default async function GenerateStoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ seriesId: string }>
  searchParams: Promise<{ continueFrom?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { seriesId } = await params
  const { continueFrom } = await searchParams
  const userId = session.user.id

  let series: Awaited<ReturnType<typeof getSeriesById>> = null
  try {
    series = await getSeriesById(seriesId, userId)
  } catch { /* DB not connected */ }
  if (!series) notFound()

  const canonBranch = series.branches.find((b) => b.isCanon) ?? series.branches[0]
  if (!canonBranch) notFound()
  const canonVolume = canonBranch.volumes[0]
  if (!canonVolume) notFound()

  // Load linked assets
  const [characters, worlds, artStyles, promptSeeds] = await Promise.all([
    prisma.characterInstance.findMany({
      where: { seriesId, archivedAt: null },
      include: { characterTemplate: { select: { id: true, name: true, description: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.seriesWorldLink.findMany({
      where: { seriesId },
      include: { worldTemplate: { select: { id: true, name: true, description: true } } },
    }),
    prisma.seriesArtStyleLink.findMany({
      where: { seriesId },
      include: { artStylePreset: { select: { id: true, name: true, styleKeywords: true, medium: true } } },
    }),
    prisma.seriesPromptSeedLink.findMany({
      where: { seriesId },
      include: { storyPromptSeed: { select: { id: true, name: true, prompt: true, themes: true } } },
    }),
  ])

  // Load existing stories for continuation dropdown
  const existingStories = await prisma.story.findMany({
    where: {
      archivedAt: null,
      volume: { branch: { seriesId } },
    },
    select: { id: true, title: true, order: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  // If continueFrom is set, validate it exists and load its characters
  const parentStoryId = continueFrom && existingStories.some((s) => s.id === continueFrom)
    ? continueFrom : undefined

  let inheritedCharacterIds: string[] = []
  if (parentStoryId) {
    // Get the characters that were used in the parent story from its generation run
    const parentRun = await prisma.generationRun.findFirst({
      where: { storyId: parentStoryId },
      select: { requestPayload: true },
    })
    const payload = parentRun?.requestPayload as { characterIds?: string[]; generateImages?: boolean } | null
    if (payload?.characterIds?.length) {
      inheritedCharacterIds = payload.characterIds
    }
  }

  // Check if parent story had images
  let parentHadImages = false
  if (parentStoryId) {
    const imageCount = await prisma.imageAsset.count({ where: { storyId: parentStoryId } })
    parentHadImages = imageCount > 0
  }

  // Find default art style from character portraits
  let defaultArtStyle = ""
  for (const ci of characters) {
    const template = await prisma.characterTemplate.findUnique({
      where: { id: ci.characterTemplate.id },
      select: { portraitAssetId: true },
    })
    if (template?.portraitAssetId) {
      const portrait = await prisma.imageAsset.findUnique({
        where: { id: template.portraitAssetId },
        select: { metadata: true },
      })
      const meta = portrait?.metadata as { sourceDescription?: string } | null
      // Check if the portrait prompt contains an art style hint
      if (portrait) {
        const portraitRecord = await prisma.imageAsset.findUnique({
          where: { id: template.portraitAssetId },
          select: { prompt: true },
        })
        // Extract art style from the portrait prompt
        const prompt = portraitRecord?.prompt ?? ""
        const styleMatch = prompt.match(/Art style: ([^.]+)/)
        if (styleMatch) {
          defaultArtStyle = styleMatch[1].trim()
          break
        }
      }
    }
  }

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-2xl">
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link href="/series" className="hover:text-white transition-colors">Series</Link>
          <span>/</span>
          <Link href={`/series/${seriesId}`} className="hover:text-white transition-colors">{series.name}</Link>
          <span>/</span>
          <span className="text-white/70">Generate story</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Compose a story</h1>
          <p className="text-white/50 text-sm">
            Branch: <span className="text-white/70">{canonBranch.name}</span> &middot; Volume:{" "}
            <span className="text-white/70">{canonVolume.name}</span>
          </p>
        </div>

        <GenerateStoryForm
          seriesId={seriesId}
          branchId={canonBranch.id}
          volumeId={canonVolume.id}
          characters={characters.map((ci) => ({ id: ci.characterTemplate.id, name: ci.characterTemplate.name, description: ci.characterTemplate.description }))}
          worlds={worlds.map((l) => l.worldTemplate)}
          artStyles={artStyles.map((l) => ({ ...l.artStylePreset, styleKeywords: l.artStylePreset.styleKeywords as string[] }))}
          promptSeeds={promptSeeds.map((l) => ({ ...l.storyPromptSeed, themes: l.storyPromptSeed.themes as string[] }))}
          existingStories={existingStories.map((s) => ({ id: s.id, title: s.title }))}
          initialParentStoryId={parentStoryId}
          inheritedCharacterIds={inheritedCharacterIds}
          parentHadImages={parentHadImages}
          defaultArtStyle={defaultArtStyle}
        />
      </div>
    </AppShell>
  )
}
