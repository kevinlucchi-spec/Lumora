// @ts-nocheck
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { enqueueStoryGeneration } from "@/lib/services/generation.service"
import { StoryGenerationRequestSchema } from "@/lib/schemas/request"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const parsed = StoryGenerationRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const run = await enqueueStoryGeneration(session.user.id, parsed.data)
  return NextResponse.json({ runId: run.id }, { status: 202 })
}
