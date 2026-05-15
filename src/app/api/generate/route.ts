// @ts-nocheck
import { NextResponse, after } from "next/server"
import { auth } from "@/lib/auth"
import { StoryGenerationRequestSchema } from "@/lib/schemas/request"
import { prisma } from "@/lib/prisma"
import { runStoryPipeline } from "@/lib/pipeline"

// Target ~45-55s pipeline, 120s ceiling for retries/slow networks
export const maxDuration = 120

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const parsed = StoryGenerationRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const run = await prisma.generationRun.create({
    data: {
      userId: session.user.id,
      status: "PENDING",
      requestPayload: parsed.data,
    },
  })

  // Run the pipeline after sending the 202 response.
  // next/server `after()` keeps the function alive on Vercel.
  after(async () => {
    try {
      await runStoryPipeline(parsed.data, run.id, session.user.id)
    } catch (err) {
      console.error(`[generate] Pipeline failed for run ${run.id}:`, err)
      await prisma.generationRun.update({
        where: { id: run.id },
        data: { status: "FAILED", errors: [{ step: "pipeline", critical: true, message: (err as Error).message }] },
      }).catch(() => {})
    }
  })

  return NextResponse.json({ runId: run.id }, { status: 202 })
}
