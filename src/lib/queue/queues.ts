// @ts-nocheck
import type { StoryGenerationJobData } from "./jobs/story-generation.job"
import { runStoryPipeline } from "@/lib/pipeline"

export const STORY_GENERATION_QUEUE = "story-generation"

type JobHandler = (data: StoryGenerationJobData) => Promise<void>
type EventListener = (...args: unknown[]) => void

interface InMemoryQueue {
  add(name: string, data: StoryGenerationJobData): Promise<{ id: string }>
  on(event: string, listener: EventListener): void
  close(): Promise<void>
}

const MAX_CONCURRENCY = 3
let activeJobs = 0
const pending: Array<{ id: string; name: string; data: StoryGenerationJobData }> = []
const listeners: Record<string, EventListener[]> = {}
let jobCounter = 0

function emit(event: string, ...args: unknown[]) {
  for (const fn of listeners[event] ?? []) {
    try { fn(...args) } catch {}
  }
}

async function processJob(id: string, data: StoryGenerationJobData) {
  activeJobs++
  try {
    const { runId, userId, request } = data
    await runStoryPipeline(request, runId, userId)
    emit("completed", { id })
  } catch (err) {
    emit("failed", { id }, err)
  } finally {
    activeJobs--
    drainQueue()
  }
}

function drainQueue() {
  while (activeJobs < MAX_CONCURRENCY && pending.length > 0) {
    const job = pending.shift()!
    processJob(job.id, job.data)
  }
}

let _queue: InMemoryQueue | null = null

export function getStoryGenerationQueue(): InMemoryQueue {
  if (_queue) return _queue
  _queue = {
    async add(_name: string, data: StoryGenerationJobData) {
      const id = `job-${++jobCounter}`
      if (activeJobs < MAX_CONCURRENCY) {
        processJob(id, data)
      } else {
        pending.push({ id, name: _name, data })
      }
      return { id }
    },
    on(event: string, listener: EventListener) {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(listener)
    },
    async close() {
      pending.length = 0
    },
  }
  return _queue
}
