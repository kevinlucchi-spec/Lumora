// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { DeleteButton } from "@/components/delete-button"
import { getSeriesById } from "@/lib/services/series.service"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { SeriesAssetTabs } from "./series-asset-tabs"
import { GenerationProgress } from "./generation-progress"

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { seriesId } = await params
  const userId = session.user.id

  let series: Awaited<ReturnType<typeof getSeriesById>> = null
  try {
    series = await getSeriesById(seriesId, userId)
  } catch { /* DB error */ }
  if (series === undefined) notFound()

  const name = series?.name ?? "Series"
  const description = series?.description
  const branches = series?.branches ?? []

  // Load all linked assets for this series + all global assets for the picker
  const [
    linkedCharacters, linkedWorlds, linkedArtStyles, linkedPromptSeeds,
    allCharacters, allWorlds, allArtStyles, allPromptSeeds,
  ] = await Promise.all([
    // Linked to this series
    prisma.characterInstance.findMany({
      where: { seriesId, archivedAt: null },
      include: { characterTemplate: { select: { id: true, name: true, description: true } } },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),
    prisma.seriesWorldLink.findMany({
      where: { seriesId },
      include: { worldTemplate: { select: { id: true, name: true, description: true } } },
    }).catch(() => []),
    prisma.seriesArtStyleLink.findMany({
      where: { seriesId },
      include: { artStylePreset: { select: { id: true, name: true, medium: true } } },
    }).catch(() => []),
    prisma.seriesPromptSeedLink.findMany({
      where: { seriesId },
      include: { storyPromptSeed: { select: { id: true, name: true, prompt: true } } },
    }).catch(() => []),
    // All global assets for the picker
    prisma.characterTemplate.findMany({ where: { userId, archivedAt: null }, select: { id: true, name: true, description: true }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.worldTemplate.findMany({ where: { userId, archivedAt: null }, select: { id: true, name: true, description: true }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.artStylePreset.findMany({ where: { userId, archivedAt: null }, select: { id: true, name: true, medium: true }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.storyPromptSeed.findMany({ where: { userId, archivedAt: null }, select: { id: true, name: true, prompt: true }, orderBy: { name: "asc" } }).catch(() => []),
  ])

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-white/40 mb-2">
              <Link href="/series" className="hover:text-white transition-colors">Series</Link>
              <span>/</span>
              <span className="text-white/70">{name}</span>
            </div>
            <h1 className="text-2xl font-bold mb-1">{name}</h1>
            {description && <p className="text-white/50 text-sm">{description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <DeleteButton entityType="series" entityId={seriesId} entityName={name} archiveEndpoint={`/api/series/${seriesId}`} />
            <Link href={`/series/${seriesId}/generate`} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors">
              Generate story
            </Link>
          </div>
        </div>

        <GenerationProgress seriesId={seriesId} />

        <SeriesAssetTabs
          seriesId={seriesId}
          branches={branches.map((b) => ({
            id: b.id, name: b.name, isCanon: b.isCanon,
            volumes: b.volumes.map((v) => ({
              stories: v.stories.map((s) => ({ id: s.id, title: s.title, order: s.order, storyType: s.storyType, parentStoryId: s.parentStoryId })),
            })),
          }))}
          linked={{
            characters: linkedCharacters.map((ci) => ({ id: ci.characterTemplateId, name: ci.characterTemplate.name, description: ci.characterTemplate.description })),
            worlds: linkedWorlds.map((l) => l.worldTemplate),
            artStyles: linkedArtStyles.map((l) => l.artStylePreset),
            promptSeeds: linkedPromptSeeds.map((l) => l.storyPromptSeed),
          }}
          global={{
            characters: allCharacters,
            worlds: allWorlds,
            artStyles: allArtStyles as { id: string; name: string; description?: string | null }[],
            promptSeeds: allPromptSeeds as { id: string; name: string; description?: string | null }[],
          }}
        />
      </div>
    </AppShell>
  )
}
