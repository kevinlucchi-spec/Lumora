// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const STALE_THRESHOLD_MS = 3 * 60 * 1000 // 3 minutes — if no update in this time, mark as failed

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { seriesId } = await params

  const allActive = await prisma.generationRun.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["PENDING", "RUNNING"] },
    },
    select: { id: true, status: true, providerLog: true, storyId: true, requestPayload: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  // Filter by seriesId
  const forSeries = allActive.filter((r) => {
    const payload = r.requestPayload as { seriesId?: string } | null
    return payload?.seriesId === seriesId
  })

  // Auto-expire stale runs (created > 3 min ago and still RUNNING/PENDING)
  const now = Date.now()
  const staleIds: string[] = []
  const liveRuns = forSeries.filter((r) => {
    const age = now - new Date(r.createdAt).getTime()
    if (age > STALE_THRESHOLD_MS) {
      staleIds.push(r.id)
      return false
    }
    return true
  })

  // Mark stale runs as FAILED in the background
  if (staleIds.length > 0) {
    prisma.generationRun.updateMany({
      where: { id: { in: staleIds } },
      data: { status: "FAILED", errors: [{ step: "timeout", critical: true, message: "Generation timed out" }] },
    }).catch(() => {})
  }

  // Only return the most recent run
  const latest = liveRuns[0]

  return NextResponse.json({
    runs: latest
      ? [{
          runId: latest.id,
          status: latest.status,
          steps: latest.providerLog as Array<{ step: string; status: string }>,
          storyId: latest.storyId,
        }]
      : [],
  })
}
