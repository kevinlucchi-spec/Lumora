// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
    select: { id: true, status: true, providerLog: true, storyId: true, requestPayload: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  // Filter by seriesId in the request payload (JSON field)
  const runs = allActive.filter((r: { requestPayload: unknown }) => {
    const payload = r.requestPayload as { seriesId?: string } | null
    return payload?.seriesId === seriesId
  })

  return NextResponse.json({
    runs: runs.map((r: { id: string; status: string; providerLog: unknown; storyId: string | null }) => ({
      runId: r.id,
      status: r.status,
      steps: r.providerLog as Array<{ step: string; status: string }>,
      storyId: r.storyId,
    })),
  })
}
