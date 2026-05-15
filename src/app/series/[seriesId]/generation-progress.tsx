"use client"
// @ts-nocheck

import { useState, useEffect } from "react"

interface Props {
  seriesId: string
}

interface RunStatus {
  runId: string
  status: string
  steps: Array<{ step: string; status: string }>
  storyId?: string
}

const STEP_LABELS: Record<string, string> = {
  "normalize-request": "Setting up",
  "retrieve-context": "Loading memories",
  "generate-outline": "Planning story",
  "validate-outline-round-0": "Reviewing plan",
  "generate-story-draft": "Writing story",
  "validate-story-round-0": "Checking story",
  "validate-continuity": "Checking continuity",
  "extract-scene-specs": "Extracting scenes",
  "validate-scenes": "Validating scenes",
  "enrich-image-prompts": "Preparing images",
  "extract-and-enrich-scenes": "Preparing illustrations",
  "generate-images": "Generating images",
  "generate-portraits": "Generating portraits",
  "qa-images": "Checking images",
  "update-memory": "Saving memories",
  "persist-outputs": "Saving story",
}

export function GenerationProgress({ seriesId }: Props) {
  const [runs, setRuns] = useState<RunStatus[]>([])

  useEffect(() => {
    let active = true

    async function poll() {
      try {
        const res = await fetch(`/api/series/${seriesId}/active-runs`)
        if (res.ok) {
          const data = await res.json()
          if (active) setRuns(data.runs)
        }
      } catch { /* ignore */ }

      if (active && runs.some((r) => r.status === "RUNNING" || r.status === "PENDING")) {
        setTimeout(poll, 3000)
      }
    }

    poll()
    const interval = setInterval(poll, 5000)

    return () => { active = false; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId])

  const activeRuns = runs.filter((r) => r.status === "RUNNING" || r.status === "PENDING")
  if (activeRuns.length === 0) return null

  return (
    <div className="mb-6 space-y-3">
      {activeRuns.map((run) => {
        const lastStep = run.steps[run.steps.length - 1]
        const stepLabel = lastStep ? (STEP_LABELS[lastStep.step] ?? lastStep.step) : "Starting..."
        const completedSteps = run.steps.filter((s) => s.status === "completed").length
        const progress = Math.max(5, (completedSteps / 8) * 100)

        return (
          <div key={run.runId} className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                <span className="text-sm text-indigo-300 font-medium">Generating story...</span>
              </div>
              <span className="text-xs text-white/30">{stepLabel}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
