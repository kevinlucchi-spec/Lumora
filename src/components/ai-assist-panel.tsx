"use client"
// @ts-nocheck

import { useState } from "react"

interface Props {
  assetType: "character" | "world" | "artStyle" | "promptSeed"
  /** Returns current form values for context-aware generation */
  getCurrentValues: () => Record<string, string | string[]>
  /** Called with AI-generated values to populate the form */
  onApply: (fields: Record<string, string | string[]>) => void
  placeholder?: string
}

export function AiAssistPanel({ assetType, getCurrentValues, onApply, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [refineInput, setRefineInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [hasGenerated, setHasGenerated] = useState(false)

  async function handleGenerate() {
    if (!prompt.trim()) return
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          assetType,
          userPrompt: prompt.trim(),
          currentValues: getCurrentValues(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Generation failed")
      }
      const data = await res.json()
      onApply(data.fields)
      setHasGenerated(true)
    } catch (err) {
      setError((err as Error).message)
    }
    setLoading(false)
  }

  async function handleRefine() {
    if (!refineInput.trim()) return
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine",
          assetType,
          currentValues: getCurrentValues(),
          refinementInstruction: refineInput.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Refinement failed")
      }
      const data = await res.json()
      onApply(data.fields)
      setRefineInput("")
    } catch (err) {
      setError((err as Error).message)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors"
      >
        AI Assist
      </button>
    )
  }

  return (
    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-indigo-300/80">AI Assist</span>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-white/30 hover:text-white/50">&times; close</button>
      </div>

      {!hasGenerated ? (
        /* ── Generate mode ── */
        <div className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
            placeholder={placeholder ?? "Describe what you want to create..."}
            rows={2}
            maxLength={1000}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs py-2 rounded-lg transition-colors"
          >
            {loading ? "Generating..." : "Generate draft"}
          </button>
        </div>
      ) : (
        /* ── Refine mode ── */
        <div className="space-y-2">
          <p className="text-xs text-indigo-300/60">Fields populated. Edit them directly, or refine with AI:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              placeholder="e.g. Make it more magical, less scary, younger..."
              maxLength={500}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRefine() } }}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/25 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleRefine}
              disabled={loading || !refineInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs px-4 py-2 rounded-lg transition-colors shrink-0"
            >
              {loading ? "..." : "Refine"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setHasGenerated(false); setPrompt("") }}
            className="text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            Start over with new prompt
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
