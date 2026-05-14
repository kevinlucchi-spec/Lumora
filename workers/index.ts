import { createStoryGenerationWorker } from "@/lib/queue/workers/story-generation.worker"

const worker = createStoryGenerationWorker()

console.log("[worker] Story generation worker started (in-memory)")

process.on("SIGTERM", () => worker.close())
process.on("SIGINT", () => worker.close())
