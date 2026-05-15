// @ts-nocheck
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Keep the stream alive long enough for pipeline to complete
export const maxDuration = 300

/**
 * SSE endpoint that streams pipeline progress for a generation run.
 * Client connects and receives step-by-step updates until the run completes.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { runId } = await params

  // Verify ownership
  const run = await prisma.generationRun.findFirst({
    where: { id: runId, userId: session.user.id },
  })
  if (!run) {
    return new Response("Not found", { status: 404 })
  }

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      // Poll the generation run for updates
      let lastLogCount = 0
      const MAX_POLLS = 300 // 5 minutes at 1s interval
      let polls = 0

      while (!closed && polls < MAX_POLLS) {
        polls++
        try {
          const current = await prisma.generationRun.findUnique({
            where: { id: runId },
            select: {
              status: true,
              providerLog: true,
              errors: true,
              storyId: true,
              completedAt: true,
            },
          })

          if (!current) {
            send({ type: "error", message: "Run not found" })
            break
          }

          const log = (current.providerLog ?? []) as Array<Record<string, unknown>>

          // Send any new log entries
          if (log.length > lastLogCount) {
            for (let i = lastLogCount; i < log.length; i++) {
              send({ type: "step", ...log[i] })
            }
            lastLogCount = log.length
          }

          // Check for terminal state
          const status = current.status
          if (status === "COMPLETED" || status === "PARTIAL" || status === "FAILED") {
            send({
              type: "done",
              status: status.toLowerCase(),
              storyId: current.storyId,
            })
            break
          }
        } catch {
          // DB hiccup — keep trying
        }

        // Wait 1 second between polls
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      if (!closed) {
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
