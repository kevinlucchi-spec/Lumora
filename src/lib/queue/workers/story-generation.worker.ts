// @ts-nocheck
import { getStoryGenerationQueue } from "../queues"

// In-memory queue: the worker is built into the queue itself.
// This function returns a handle compatible with the instrumentation hook.
export function createStoryGenerationWorker() {
  const queue = getStoryGenerationQueue()

  queue.on("completed", (job: unknown) => {
    const j = job as { id?: string }
    console.log(`[worker] Job ${j.id} completed`)
  })

  queue.on("failed", (job: unknown, err: unknown) => {
    const j = job as { id?: string }
    const e = err as { message?: string }
    console.error(`[worker] Job ${j?.id} failed:`, e?.message)
  })

  return {
    async close() {
      await queue.close()
    },
  }
}
