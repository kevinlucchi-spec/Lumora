"use client"
// @ts-nocheck

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AiAssistPanel } from "@/components/ai-assist-panel"

export function NewCharacterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [personality, setPersonality] = useState("")
  const [appearance, setAppearance] = useState("")
  const [voiceTone, setVoiceTone] = useState("")
  const [age, setAge] = useState("")
  const [tags, setTags] = useState("")

  function getCurrentValues() {
    return { name, description, age, personality, appearance, voiceTone, tags }
  }

  function applyAiValues(fields: Record<string, string | string[]>) {
    if (fields.name) setName(fields.name as string)
    if (fields.description) setDescription(fields.description as string)
    if (fields.age) setAge(fields.age as string)
    if (fields.personality) setPersonality(fields.personality as string)
    if (fields.appearance) setAppearance(fields.appearance as string)
    if (fields.voiceTone) setVoiceTone(fields.voiceTone as string)
    if (fields.tags) setTags(fields.tags as string)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/library/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          essence: { personality, appearance, voiceTone, age },
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error ?? "Failed to create character")
      }
      const created = await res.json()
      router.push(`/library/characters/${created.id}`)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* AI Assist */}
      <AiAssistPanel
        assetType="character"
        getCurrentValues={getCurrentValues}
        onApply={applyAiValues}
        placeholder='e.g. "A gentle fox child for bedtime stories" or "A wise old owl librarian"'
      />

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">Name <span className="text-red-400">*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bramble the Badger" required maxLength={100}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One-line summary of this character" maxLength={300}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">Age / Stage</label>
          <input type="text" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. Young adult fox, wise but playful"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Character essence</h3>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">Personality</label>
          <textarea value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="e.g. Curious, brave, occasionally overconfident. Loves puzzles and helping friends." rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">Appearance</label>
          <textarea value={appearance} onChange={(e) => setAppearance(e.target.value)} placeholder="e.g. A small silver fox with bright amber eyes and a bushy tail tipped with white." rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">Voice & tone</label>
          <textarea value={voiceTone} onChange={(e) => setVoiceTone(e.target.value)} placeholder="e.g. Speaks in short, enthusiastic sentences. Uses nature metaphors. Never mean." rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">Tags</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="animal, brave, woodland (comma-separated)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">Privacy</label>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5">
            <span className="text-sm text-white/60">Private</span>
            <span className="text-xs text-white/30 ml-auto">Only you can use this character</span>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading || !name.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
          {loading ? "Creating\u2026" : "Create character"}
        </button>
        <Link href="/library/characters" className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-6 py-2.5 rounded-lg text-sm transition-colors">Cancel</Link>
      </div>
    </form>
  )
}
