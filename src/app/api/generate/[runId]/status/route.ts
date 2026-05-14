import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGenerationRun } from "@/lib/services/generation.service"

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { runId } = await params
  const run = await getGenerationRun(runId, session.user.id)
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({
    runId: run.id,
    status: run.status,
    storyId: run.storyId,
    completedAt: run.completedAt,
  })
}
