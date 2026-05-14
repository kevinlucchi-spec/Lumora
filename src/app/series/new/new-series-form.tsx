"use client"
// @ts-nocheck

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AiAssistPanel } from "@/components/ai-assist-panel"

const SHARE_OPTIONS = [
  { value: "PRIVATE", label: "Private", desc: "Only you can see this series" },
  { value: "PUBLIC_VIEW", label: "Public", desc: "Visible to everyone on Discover" },
  { value: "PUBLIC_REUSE", label: "Public + Reusable", desc: "Others can copy characters and worlds" },
]

export function NewSeriesForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [sharePolicy, setSharePolicy] = useState("PRIVATE")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function getCurrentValues() {
    return { name, description }
  }

  function applyAiValues(fields: Record<string, string | string[]>) {
    if (fields.name) setName(fields.name as string)
    if (fields.description) setDescription(fields.description as string)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, sharePolicy }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message ?? "Failed to create series")
      }

      const series = await res.json()
      router.push(`/series/${series.id}`)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AiAssistPanel
        assetType="world"
        getCurrentValues={getCurrentValues}
        onApply={applyAiValues}
        placeholder='e.g. "A cozy adventure series about a girl and her talking cat" or "Bedtime stories set in a magical underwater kingdom"'
      />

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Series name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Moonwood Chronicles"
            required
            maxLength={200}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of this story universe..."
            rows={3}
            maxLength={1000}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">Sharing</label>
          <div className="grid grid-cols-1 gap-2">
            {SHARE_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setSharePolicy(opt.value)}
                className={`text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                  sharePolicy === opt.value
                    ? "border-indigo-500 bg-indigo-500/10 text-white"
                    : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"
                }`}>
                <span className="font-medium">{opt.label}</span>
                <span className="text-xs text-white/30 ml-2">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Creating..." : "Create series"}
        </button>
        <Link
          href="/series"
          className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
