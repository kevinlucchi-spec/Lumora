// @ts-nocheck
import { prisma } from "@/lib/prisma"
import type { WorldCanonSnapshot } from "./types"

export async function getWorldCanonSnapshot(seriesId: string): Promise<WorldCanonSnapshot> {
  const canon = await prisma.worldCanon.findUnique({ where: { seriesId } })

  return {
    seriesId,
    rules: (canon?.rules as Record<string, unknown>) ?? {},
    lore: (canon?.lore as Record<string, unknown>) ?? {},
    toneGuide: (canon?.toneGuide as Record<string, unknown>) ?? {},
  }
}
