import { prisma } from "@/lib/prisma"
import type { BranchMemorySnapshot } from "./types"

export async function getBranchMemorySnapshot(branchId: string): Promise<BranchMemorySnapshot> {
  const memory = await prisma.branchMemory.findUnique({ where: { branchId } })

  return {
    branchId,
    facts: (memory?.facts as Record<string, unknown>) ?? {},
    recentEvents: ((memory?.eventLog as unknown[]) ?? []).slice(-20) as never,
  }
}

export async function updateBranchMemory(
  branchId: string,
  updates: {
    newFacts?: Record<string, unknown>
    newEvent?: { storyId: string; summary: string }
  },
): Promise<void> {
  const existing = await prisma.branchMemory.findUnique({ where: { branchId } })
  const currentFacts = (existing?.facts as Record<string, unknown>) ?? {}
  const eventLog = (existing?.eventLog as unknown[]) ?? []

  if (updates.newEvent) {
    eventLog.push({ ...updates.newEvent, timestamp: new Date().toISOString() })
  }

  const mergedFacts = { ...currentFacts, ...(updates.newFacts ?? {}) }

  if (!existing) {
    await prisma.branchMemory.create({
      data: { branchId, facts: mergedFacts as never, eventLog: eventLog as never },
    })
    return
  }

  await prisma.branchMemory.update({
    where: { branchId },
    data: { facts: mergedFacts as never, eventLog: eventLog as never },
  })
}
