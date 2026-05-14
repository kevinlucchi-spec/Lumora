import { prisma } from "@/lib/prisma"
import type { CharacterMemorySnapshot } from "./types"

export async function getCharacterMemorySnapshots(
  characterInstanceIds: string[],
): Promise<CharacterMemorySnapshot[]> {
  if (characterInstanceIds.length === 0) return []

  const instances = await prisma.characterInstance.findMany({
    where: { id: { in: characterInstanceIds } },
    include: {
      characterTemplate: true,
      characterMemory: true,
    },
  })

  return instances.map((instance) => ({
    characterInstanceId: instance.id,
    characterName: instance.nameOverride ?? instance.characterTemplate.name,
    stableFacts: (instance.characterMemory?.stableFacts as Record<string, unknown>) ?? {},
    evolvingState: (instance.characterMemory?.evolvingState as Record<string, unknown>) ?? {},
    recentEvents: ((instance.characterMemory?.eventLog as unknown[]) ?? []).slice(-10) as never,
  }))
}

export async function updateCharacterMemory(
  characterInstanceId: string,
  updates: {
    evolvingState?: Record<string, unknown>
    newEvent?: { storyId: string; summary: string }
  },
): Promise<void> {
  const existing = await prisma.characterMemory.findUnique({
    where: { characterInstanceId },
  })

  if (!existing) {
    await prisma.characterMemory.create({
      data: {
        characterInstanceId,
        stableFacts: {} as never,
        evolvingState: (updates.evolvingState ?? {}) as never,
        eventLog: (updates.newEvent
          ? [{ ...updates.newEvent, timestamp: new Date().toISOString() }]
          : []) as never,
      },
    })
    return
  }

  const eventLog = (existing.eventLog as unknown[]) ?? []
  if (updates.newEvent) {
    eventLog.push({ ...updates.newEvent, timestamp: new Date().toISOString() })
  }

  await prisma.characterMemory.update({
    where: { characterInstanceId },
    data: {
      evolvingState: (updates.evolvingState ?? existing.evolvingState) as never,
      eventLog: eventLog as never,
    },
  })
}
