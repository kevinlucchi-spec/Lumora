"use client"
// @ts-nocheck

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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

interface World {
  id: string
  name: string
  description: string | null
  tags: string[]
  updatedAt: string
}

export default function WorldsPage() {
  const router = useRouter()
  const [worlds, setWorlds] = useState<World[]>([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [magicSystem, setMagicSystem] = useState("")
  const [tone, setTone] = useState("")
  const [setting, setSetting] = useState("")
  const [tags, setTags] = useState("")

  useEffect(() => {
    fetch("/api/library/worlds").then((r) => r.json()).then(setWorlds).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/library/worlds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          rules: { magicSystem, setting },
          toneGuide: { tone },
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error("Failed to create world")
      const world = await res.json()
      setWorlds((prev) => [world, ...prev])
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
    setMagicSystem("")
    setTone("")
    setSetting("")
    setTags("")
  }

  return (
    <AppShell>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Library</h1>
            <p className="text-white/50 text-sm">Reusable creative assets</p>
          </div>
          <button onClick={() => setCreating(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors">
            + New world
          </button>
        </div>
        <div className="flex gap-1 border-b border-white/10 mb-8">
          {LIBRARY_TABS.map((tab) => (
            <Link key={tab.href} href={tab.href}
              className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${tab.href === "/library/worlds" ? "border-indigo-500 text-white" : "border-transparent text-white/40 hover:text-white/70"}`}>
              {tab.label}
            </Link>
          ))}
        </div>

        {creating && (
          <form onSubmit={handleCreate} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">New World</h3>
              <AiAssistPanel
                assetType="world"
                getCurrentValues={() => ({ name, description, setting, magicSystem, tone, tags })}
                onApply={(f) => {
                  if (f.name) setName(f.name as string)
                  if (f.description) setDescription(f.description as string)
                  if (f.setting) setSetting(f.setting as string)
                  if (f.magicSystem) setMagicSystem(f.magicSystem as string)
                  if (f.tone) setTone(f.tone as string)
                  if (f.tags) setTags(f.tags as string)
                }}
                placeholder='e.g. "A cozy moonlit forest with talking trees"'
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Name <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="e.g. The Whispering Woods" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="A brief summary of this world" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Setting</label>
              <textarea value={setting} onChange={(e) => setSetting(e.target.value)} rows={2} placeholder="e.g. An enchanted forest where trees can talk and rivers glow at night" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Magic / Rules</label>
              <textarea value={magicSystem} onChange={(e) => setMagicSystem(e.target.value)} rows={2} placeholder="e.g. Magic comes from kindness. Spells only work when you truly mean them." className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Tone</label>
              <input type="text" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. Warm, magical, slightly mysterious but always safe" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Tags</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="forest, magic, animals (comma-separated)" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving || !name.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">{saving ? "Creating..." : "Create world"}</button>
              <button type="button" onClick={resetForm} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-5 py-2 rounded-lg text-sm transition-colors">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-white/30 text-sm">Loading...</p>
        ) : worlds.length === 0 && !creating ? (
          <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center">
            <div className="text-4xl mb-3">🌍</div>
            <p className="text-white/50 text-sm mb-4">No world templates yet.</p>
            <button onClick={() => setCreating(true)} className="inline-flex bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors">Create a world</button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {worlds.map((w) => (
              <div key={w.id} className="bg-white/5 border border-white/10 rounded-xl p-5 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center text-base shrink-0">🌍</div>
                  <DeleteButton entityType="worldTemplate" entityId={w.id} entityName={w.name} archiveEndpoint={`/api/library/worlds/${w.id}`} onDeleted={() => setWorlds((prev) => prev.filter((x) => x.id !== w.id))} />
                </div>
                <p className="font-medium text-sm mt-3 mb-1">{w.name}</p>
                {w.description && <p className="text-xs text-white/40 line-clamp-2">{w.description}</p>}
                {w.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {w.tags.slice(0, 4).map((t) => (
                      <span key={t} className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-white/40">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
