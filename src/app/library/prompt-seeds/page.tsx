"use client"
// @ts-nocheck

import { useState, useEffect } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { AiAssistPanel } from "@/components/ai-assist-panel"
import { DeleteButton } from "@/components/delete-button"
import Link from "next/link"

const LIBRARY_TABS = [
  { label: "Characters", href: "/library/characters" },
  { label: "Worlds", href: "/library/worlds" },
  { label: "Art Styles", href: "/library/art-styles" },
  { label: "Prompt Seeds", href: "/library/prompt-seeds" },
]

const MODE_OPTIONS = [
  "CALM_BEDTIME", "COZY_ADVENTURE", "MORAL_LESSON", "DREAMLIKE",
  "SIBLING_FAMILY", "WHAT_IF_BRANCH", "CUSTOM",
]

const MODE_LABELS: Record<string, string> = {
  CALM_BEDTIME: "Calm bedtime", COZY_ADVENTURE: "Cozy adventure", MORAL_LESSON: "Moral lesson",
  DREAMLIKE: "Dreamlike", SIBLING_FAMILY: "Sibling & family",
  WHAT_IF_BRANCH: "What if...", CUSTOM: "Custom",
}

interface PromptSeed {
  id: string
  name: string
  prompt: string
  themes: string[]
  suggestedModes: string[]
  updatedAt: string
}

export default function PromptSeedsPage() {
  const [seeds, setSeeds] = useState<PromptSeed[]>([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [prompt, setPrompt] = useState("")
  const [themes, setThemes] = useState("")
  const [selectedModes, setSelectedModes] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/library/prompt-seeds").then((r) => r.json()).then(setSeeds).finally(() => setLoading(false))
  }, [])

  function toggleMode(mode: string) {
    setSelectedModes((prev) => prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/library/prompt-seeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          prompt,
          themes: themes.split(",").map((t) => t.trim()).filter(Boolean),
          suggestedModes: selectedModes,
        }),
      })
      if (!res.ok) throw new Error("Failed to create prompt seed")
      const seed = await res.json()
      setSeeds((prev) => [seed, ...prev])
      resetForm()
    } catch (err) {
      setError((err as Error).message)
    }
    setSaving(false)
  }

  function resetForm() {
    setCreating(false)
    setName("")
    setPrompt("")
    setThemes("")
    setSelectedModes([])
  }

  return (
    <AppShell>
      <div className="px-8 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Library</h1>
            <p className="text-white/50 text-sm">Reusable creative assets</p>
          </div>
          <button onClick={() => setCreating(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors">
            + New seed
          </button>
        </div>
        <div className="flex gap-1 border-b border-white/10 mb-8">
          {LIBRARY_TABS.map((tab) => (
            <Link key={tab.href} href={tab.href}
              className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${tab.href === "/library/prompt-seeds" ? "border-indigo-500 text-white" : "border-transparent text-white/40 hover:text-white/70"}`}>
              {tab.label}
            </Link>
          ))}
        </div>

        {creating && (
          <form onSubmit={handleCreate} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">New Prompt Seed</h3>
              <AiAssistPanel
                assetType="promptSeed"
                getCurrentValues={() => ({ name, prompt, themes, suggestedModes: selectedModes })}
                onApply={(f) => {
                  if (f.name) setName(f.name as string)
                  if (f.prompt) setPrompt(f.prompt as string)
                  if (f.themes) setThemes(f.themes as string)
                  if (Array.isArray(f.suggestedModes)) setSelectedModes(f.suggestedModes as string[])
                }}
                placeholder='e.g. "A story about being nervous on the first day of school but feeling safe"'
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Name <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="e.g. The Lost Constellation" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Prompt <span className="text-red-400">*</span></label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} required minLength={10} maxLength={2000} rows={4} placeholder="e.g. A little bear looks up at the night sky and notices one of the constellations is missing. They set off on a journey to find the lost stars..." className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
              <p className="text-xs text-white/30 mt-1">{prompt.length} / 2000</p>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Themes</label>
              <input type="text" value={themes} onChange={(e) => setThemes(e.target.value)} placeholder="friendship, stars, adventure (comma-separated)" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Suggested modes</label>
              <div className="flex flex-wrap gap-2">
                {MODE_OPTIONS.map((mode) => (
                  <button key={mode} type="button" onClick={() => toggleMode(mode)}
                    className={`px-3 py-1 rounded-full border text-xs transition-colors ${selectedModes.includes(mode) ? "border-indigo-500 bg-indigo-500/20 text-indigo-200" : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"}`}>
                    {MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving || !name.trim() || prompt.length < 10} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">{saving ? "Creating..." : "Create seed"}</button>
              <button type="button" onClick={resetForm} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-5 py-2 rounded-lg text-sm transition-colors">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-white/30 text-sm">Loading...</p>
        ) : seeds.length === 0 && !creating ? (
          <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-white/50 text-sm mb-4">No prompt seeds yet.</p>
            <button onClick={() => setCreating(true)} className="inline-flex bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors">Create a prompt seed</button>
          </div>
        ) : (
          <div className="grid gap-3">
            {seeds.map((s) => (
              <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-sm">{s.name}</p>
                  <DeleteButton entityType="storyPromptSeed" entityId={s.id} entityName={s.name} archiveEndpoint={`/api/library/prompt-seeds/${s.id}`} />
                </div>
                <p className="text-xs text-white/50 mt-2 line-clamp-3">{s.prompt}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {s.themes.map((t) => (
                    <span key={t} className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-white/40">{t}</span>
                  ))}
                  {s.suggestedModes.map((m) => (
                    <span key={m} className="text-xs bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full text-indigo-300/60">{MODE_LABELS[m] ?? m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
