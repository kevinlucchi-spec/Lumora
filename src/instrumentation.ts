// @ts-nocheck
/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Used to bootstrap the BullMQ story generation worker.
 */
export async function register() {
  // Only start the worker on the Node.js server runtime (not in the browser or edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { createStoryGenerationWorker } = await import("@/lib/queue/workers/story-generation.worker")
    const worker = createStoryGenerationWorker()
    console.log("[worker] Story generation worker started, listening for jobs...")

    // Graceful shutdown
    const shutdown = async () => {
      console.log("[worker] Shutting down story generation worker...")
      await worker.close()
    }
    process.on("SIGTERM", shutdown)
    process.on("SIGINT", shutdown)
  }
}
