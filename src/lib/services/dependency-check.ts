import { prisma } from "@/lib/prisma"

export interface DependencyReport {
  canHardDelete: boolean
  dependencies: { type: string; count: number; label: string }[]
}

/**
 * Check what depends on a given entity before allowing hard delete.
 * Returns a report of all dependencies that would be affected.
 *
 * For library assets (characters, worlds, art styles, prompt seeds),
 * only counts references from non-archived stories/series.
 * If all referencing stories have been deleted, the asset becomes eligible
 * for hard delete again.
 */
export async function checkDependencies(
  entityType: string,
  entityId: string,
): Promise<DependencyReport> {
  const deps: { type: string; count: number; label: string }[] = []

  switch (entityType) {
    case "series": {
      const branches = await prisma.branch.count({ where: { seriesId: entityId } })
      const characters = await prisma.characterInstance.count({ where: { seriesId: entityId } })
      if (branches > 0) deps.push({ type: "branch", count: branches, label: "branches" })
      if (characters > 0) deps.push({ type: "characterInstance", count: characters, label: "character instances" })
      break
    }

    case "branch": {
      const volumes = await prisma.volume.count({ where: { branchId: entityId } })
      const children = await prisma.branch.count({ where: { parentBranchId: entityId } })
      if (volumes > 0) deps.push({ type: "volume", count: volumes, label: "volumes" })
      if (children > 0) deps.push({ type: "branch", count: children, label: "child branches" })
      break
    }

    case "volume": {
      const stories = await prisma.story.count({ where: { volumeId: entityId, archivedAt: null } })
      if (stories > 0) deps.push({ type: "story", count: stories, label: "stories" })
      break
    }

    case "story": {
      // Stories with forked branches cannot be hard-deleted
      const forks = await prisma.branch.count({ where: { forkFromStoryId: entityId } })
      if (forks > 0) deps.push({ type: "branch", count: forks, label: "forked branches" })
      // Scene specs and images cascade-delete with the story, so they don't block
      break
    }

    case "characterTemplate": {
      // Only block if there are character instances in series that have active (non-archived) stories
      const instances = await prisma.characterInstance.findMany({
        where: { characterTemplateId: entityId },
        select: { seriesId: true },
      })
      if (instances.length > 0) {
        // Check if any of those series have non-archived stories
        const seriesIds = [...new Set(instances.map((i) => i.seriesId))]
        const activeStoryCount = await prisma.story.count({
          where: {
            archivedAt: null,
            volume: { branch: { seriesId: { in: seriesIds } } },
          },
        })
        if (activeStoryCount > 0) {
          deps.push({ type: "characterInstance", count: instances.length, label: "character instances in series with active stories" })
        }
        // If all stories are archived/deleted, instances exist but don't block hard delete
      }
      break
    }

    case "worldTemplate": {
      const worldLinks = await prisma.seriesWorldLink.findMany({
        where: { worldTemplateId: entityId },
        select: { seriesId: true },
      })
      if (worldLinks.length > 0) {
        const seriesIds = worldLinks.map((l) => l.seriesId)
        const activeStoryCount = await prisma.story.count({
          where: {
            archivedAt: null,
            volume: { branch: { seriesId: { in: seriesIds } } },
          },
        })
        if (activeStoryCount > 0) {
          deps.push({ type: "worldLink", count: worldLinks.length, label: "world links in series with active stories" })
        }
      }
      break
    }

    case "artStylePreset": {
      const styleLinks = await prisma.seriesArtStyleLink.findMany({
        where: { artStylePresetId: entityId },
        select: { seriesId: true },
      })
      if (styleLinks.length > 0) {
        const seriesIds = styleLinks.map((l) => l.seriesId)
        const activeStoryCount = await prisma.story.count({
          where: {
            archivedAt: null,
            volume: { branch: { seriesId: { in: seriesIds } } },
          },
        })
        if (activeStoryCount > 0) {
          deps.push({ type: "artStyleLink", count: styleLinks.length, label: "art style links in series with active stories" })
        }
      }
      break
    }

    case "storyPromptSeed": {
      const seedLinks = await prisma.seriesPromptSeedLink.findMany({
        where: { storyPromptSeedId: entityId },
        select: { seriesId: true },
      })
      if (seedLinks.length > 0) {
        const seriesIds = seedLinks.map((l) => l.seriesId)
        const activeStoryCount = await prisma.story.count({
          where: {
            archivedAt: null,
            volume: { branch: { seriesId: { in: seriesIds } } },
          },
        })
        if (activeStoryCount > 0) {
          deps.push({ type: "promptSeedLink", count: seedLinks.length, label: "prompt seed links in series with active stories" })
        }
      }
      break
    }
  }

  return {
    canHardDelete: deps.length === 0,
    dependencies: deps,
  }
}

/**
 * Perform a hard delete with dependency check.
 * Returns { deleted: true } or { deleted: false, reason, dependencies }.
 */
export async function hardDelete(
  entityType: string,
  entityId: string,
  userId: string,
  force: boolean = false,
): Promise<{ deleted: boolean; reason?: string; dependencies?: DependencyReport["dependencies"] }> {
  const report = await checkDependencies(entityType, entityId)

  if (!report.canHardDelete && !force) {
    return {
      deleted: false,
      reason: "Entity has dependencies. Archive it instead, or pass force=true to permanently delete everything.",
      dependencies: report.dependencies,
    }
  }

  switch (entityType) {
    case "series":
      await prisma.series.deleteMany({ where: { id: entityId, userId } })
      break
    case "branch":
      await prisma.branch.delete({ where: { id: entityId } })
      break
    case "volume":
      await prisma.volume.delete({ where: { id: entityId } })
      break
    case "story":
      await prisma.story.delete({ where: { id: entityId } })
      break
    case "characterTemplate":
      await prisma.characterTemplate.deleteMany({ where: { id: entityId, userId } })
      break
    case "worldTemplate":
      await prisma.worldTemplate.deleteMany({ where: { id: entityId, userId } })
      break
    case "artStylePreset":
      await prisma.artStylePreset.deleteMany({ where: { id: entityId, userId } })
      break
    case "storyPromptSeed":
      await prisma.storyPromptSeed.deleteMany({ where: { id: entityId, userId } })
      break
    default:
      return { deleted: false, reason: `Unknown entity type: ${entityType}` }
  }

  return { deleted: true }
}
