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

interface ArtStyle {
  id: string
  name: string
  description: string | null
  styleKeywords: string[]
  medium: string | null
  colorPalette: string | null
  updatedAt: string
}

export default function ArtStylesPage() {
  const [styles, setStyles] = useState<ArtStyle[]>([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [keywords, setKeywords] = useState("")
  const [medium, setMedium] = useState("")
  const [colorPalette, setColorPalette] = useState("")
  const [negativeTerms, setNegativeTerms] = useState("")

  useEffect(() => {
    fetch("/api/library/art-styles").then((r) => r.json()).then(setStyles).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/library/art-styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          styleKeywords: keywords.split(",").map((t) => t.trim()).filter(Boolean),
          medium: medium || undefined,
          colorPalette: colorPalette || undefined,
          negativeTerms: negativeTerms.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error("Failed to create art style")
      const style = await res.json()
      setStyles((prev) => [style, ...prev])
      resetForm()
    } catch (err) {
      setError((err as Error).message)
    }
    setSaving(false)
  }

  function resetForm() {
    setCreating(false)
    setName("")
    setDescription("")
    setKeywords("")
    setMedium("")
    setColorPalette("")
    setNegativeTerms("")
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
            + New art style
          </button>
        </div>
        <div className="flex gap-1 border-b border-white/10 mb-8">
          {LIBRARY_TABS.map((tab) => (
            <Link key={tab.href} href={tab.href}
              className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${tab.href === "/library/art-styles" ? "border-indigo-500 text-white" : "border-transparent text-white/40 hover:text-white/70"}`}>
              {tab.label}
            </Link>
          ))}
        </div>

        {creating && (
          <form onSubmit={handleCreate} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">New Art Style</h3>
              <AiAssistPanel
                assetType="artStyle"
                getCurrentValues={() => ({ name, description, keywords, medium, colorPalette, negativeTerms })}
                onApply={(f) => {
                  if (f.name) setName(f.name as string)
                  if (f.description) setDescription(f.description as string)
                  if (f.keywords) setKeywords(f.keywords as string)
                  if (f.medium) setMedium(f.medium as string)
                  if (f.colorPalette) setColorPalette(f.colorPalette as string)
                  if (f.negativeTerms) setNegativeTerms(f.negativeTerms as string)
                }}
                placeholder='e.g. "Soft watercolor style for peaceful bedtime scenes"'
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Name <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="e.g. Cozy Watercolor" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="A brief description of this visual style" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Style keywords <span className="text-red-400">*</span></label>
              <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} required placeholder="watercolor, soft edges, warm tones, children's book (comma-separated)" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-1.5">Medium</label>
                <input type="text" value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="e.g. watercolor, digital, pencil" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1.5">Color palette</label>
                <input type="text" value={colorPalette} onChange={(e) => setColorPalette(e.target.value)} placeholder="e.g. warm pastels, earth tones" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Negative terms (avoid these in images)</label>
              <input type="text" value={negativeTerms} onChange={(e) => setNegativeTerms(e.target.value)} placeholder="photorealistic, scary, dark, violent (comma-separated)" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving || !name.trim() || !keywords.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">{saving ? "Creating..." : "Create art style"}</button>
              <button type="button" onClick={resetForm} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-5 py-2 rounded-lg text-sm transition-colors">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-white/30 text-sm">Loading...</p>
        ) : styles.length === 0 && !creating ? (
          <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center">
            <div className="text-4xl mb-3">🎨</div>
            <p className="text-white/50 text-sm mb-4">No art style presets yet.</p>
            <button onClick={() => setCreating(true)} className="inline-flex bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors">Create an art style</button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {styles.map((s) => (
              <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-5 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-9 h-9 rounded-lg bg-pink-500/20 flex items-center justify-center text-base shrink-0">🎨</div>
                  <DeleteButton entityType="artStylePreset" entityId={s.id} entityName={s.name} archiveEndpoint={`/api/library/art-styles/${s.id}`} />
                </div>
                <p className="font-medium text-sm mt-3 mb-1">{s.name}</p>
                {s.description && <p className="text-xs text-white/40 line-clamp-2">{s.description}</p>}
                {s.medium && <p className="text-xs text-white/30 mt-1">Medium: {s.medium}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.styleKeywords.slice(0, 5).map((k) => (
                    <span key={k} className="text-xs bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full text-pink-300/60">{k}</span>
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
