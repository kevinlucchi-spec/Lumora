// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const ShareSchema = z.object({
  entityType: z.enum(["series", "story", "character", "world"]),
  entityId: z.string(),
  sharePolicy: z.enum(["PRIVATE", "UNLISTED", "PUBLIC_VIEW", "PUBLIC_REUSE"]),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = ShareSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const { entityType, entityId, sharePolicy } = parsed.data
  const userId = session.user.id

  switch (entityType) {
    case "series":
      await prisma.series.updateMany({ where: { id: entityId, userId }, data: { sharePolicy } })
      break
    case "story":
      await prisma.story.updateMany({ where: { id: entityId, volume: { branch: { series: { userId } } } }, data: { sharePolicy } })
      break
    case "character":
      await prisma.characterTemplate.updateMany({ where: { id: entityId, userId }, data: { sharePolicy } })
      break
    case "world":
      await prisma.worldTemplate.updateMany({ where: { id: entityId, userId }, data: { sharePolicy } })
      break
  }

  return NextResponse.json({ ok: true, sharePolicy })
}
