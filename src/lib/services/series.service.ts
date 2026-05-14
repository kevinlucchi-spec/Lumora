// @ts-nocheck
import { prisma } from "@/lib/prisma"
type SharePolicy = string

export async function getSeriesForUser(userId: string) {
  return prisma.series.findMany({
    where: { userId, archivedAt: null },
    include: { branches: { select: { id: true, name: true, isCanon: true } } },
    orderBy: { updatedAt: "desc" },
  })
}

export async function createSeries(userId: string, data: { name: string; description?: string }) {
  return prisma.series.create({
    data: {
      ...data,
      userId,
      branches: {
        create: {
          name: "Main",
          isCanon: true,
          volumes: {
            create: { name: "Volume 1", order: 1 },
          },
        },
      },
    },
    include: {
      branches: { include: { volumes: true } },
    },
  })
}

export async function getSeriesById(id: string, userId: string) {
  return prisma.series.findFirst({
    where: { id, userId, archivedAt: null },
    include: {
      branches: { include: { volumes: { include: { stories: { where: { archivedAt: null }, select: { id: true, title: true, order: true, storyType: true, parentStoryId: true }, orderBy: { order: "asc" } } } } } },
      worldCanon: true,
      characterInstances: { include: { characterTemplate: true } },
    },
  })
}

export async function updateSeries(id: string, userId: string, data: { name?: string; description?: string; sharePolicy?: SharePolicy }) {
  return prisma.series.updateMany({
    where: { id, userId },
    data,
  })
}

export async function deleteSeries(id: string, userId: string) {
  const result = await prisma.series.updateMany({
    where: { id, userId, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  return result
}
