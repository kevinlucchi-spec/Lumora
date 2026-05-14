# Job Queue & Worker Design

## Technology

- **Redis** — backing store for BullMQ
- **BullMQ** — queue, worker, and job event management
- **Separate worker process** — `workers/index.ts` runs independently of the Next.js app

Running the worker separately (not in a Next.js API route) is critical: story generation takes 20–60 seconds and uses significant memory. Serverless/Edge environments cannot support this.

---

## Queue Definitions

```typescript
// lib/queue/queues.ts

import { Queue } from "bullmq"
import { redis } from "./client"

export const storyGenerationQueue = new Queue("story-generation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
})
```

One queue for MVP: `story-generation`. Future queues: `image-generation` (separated for independent retry), `memory-update` (deferred writes).

---

## Job Payload

```typescript
// lib/queue/jobs/story-generation.job.ts

export interface StoryGenerationJobData {
  runId: string
  userId: string
  request: StoryGenerationRequest   // fully validated Zod-parsed request
}

export type StoryGenerationJob = Job<StoryGenerationJobData>
```

---

## Enqueueing

```typescript
// lib/services/generation.service.ts

async function enqueueGeneration(
  userId: string,
  request: StoryGenerationRequest,
): Promise<string> {
  // 1. Create GenerationRun record with PENDING status
  const run = await prisma.generationRun.create({
    data: {
      userId,
      status: "PENDING",
      requestPayload: request,
    },
  })

  // 2. Enqueue job with runId
  await storyGenerationQueue.add("generate", {
    runId: run.id,
    userId,
    request,
  }, {
    jobId: run.id,  // idempotent — same runId = same job
  })

  return run.id
}
```

---

## Worker

```typescript
// workers/index.ts  (standalone process)

import { Worker } from "bullmq"
import { redis } from "@/lib/queue/client"
import { runStoryPipeline } from "@/lib/pipeline"
import { prisma } from "@/lib/prisma"

const worker = new Worker<StoryGenerationJobData>(
  "story-generation",
  async (job) => {
    const { runId, userId, request } = job.data

    await prisma.generationRun.update({
      where: { id: runId },
      data: { status: "RUNNING" },
    })

    const ctx = await runStoryPipeline(request, runId, userId)

    await prisma.generationRun.update({
      where: { id: runId },
      data: {
        status: ctx.status === "completed" ? "COMPLETED"
               : ctx.status === "partial"  ? "PARTIAL"
               : "FAILED",
        completedAt: new Date(),
      },
    })
  },
  {
    connection: redis,
    concurrency: 3,   // 3 concurrent generation jobs
  },
)

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err)
})
```

---

## Job Status Polling

```typescript
// app/api/generate/[runId]/status/route.ts

export async function GET(req, { params }) {
  const session = await getSession()
  const run = await prisma.generationRun.findUnique({
    where: { id: params.runId, userId: session.user.id },
    select: {
      status: true,
      storyId: true,
      providerLog: true,
      errors: true,
      completedAt: true,
    },
  })
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: run })
}
```

Client polls every 2 seconds until `status` is `COMPLETED`, `FAILED`, or `PARTIAL`.
SSE upgrade is a V2 enhancement.

---

## Progress Tracking

The `GenerationRun.providerLog` field is updated after each pipeline step. The status endpoint returns the current log length, which the client uses to show step-by-step progress.

```typescript
// After each step in the pipeline:
await prisma.generationRun.update({
  where: { id: ctx.runId },
  data: {
    providerLog: ctx.log,   // append-only array
  },
})
```

---

## Scaling Notes

- At MVP: single worker instance, 3 concurrent jobs, sufficient for ~50 concurrent users
- At scale: multiple worker replicas behind same Redis queue (BullMQ handles coordination)
- Image generation can be split into its own queue with higher concurrency
- Rate limiting: per-user job count checked before enqueueing (max 2 active jobs per user)
