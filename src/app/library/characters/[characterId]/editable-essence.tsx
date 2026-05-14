"use client"
// @ts-nocheck

import { useState } from "react"

interface Props {
  characterId: string
  initialName: string
  initialDescription: string | null
  initialEssence: { personality?: string; appearance?: string; voiceTone?: string; age?: string }
  initialTags: string[]
}

export function EditableEssence({ characterId, initialName, initialDescription, initialEssence, initialTags }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription ?? "")
  const [personality, setPersonality] = useState(initialEssence.personality ?? "")
  const [appearance, setAppearance] = useState(initialEssence.appearance ?? "")
  const [voiceTone, setVoiceTone] = useState(initialEssence.voiceTone ?? "")
  const [age, setAge] = useState(initialEssence.age ?? "")
  const [tags, setTags] = useState(initialTags.join(", "))

  // Display values (update after save)
  const [displayName, setDisplayName] = useState(initialName)
  const [displayDesc, setDisplayDesc] = useState(initialDescription ?? "")
  const [displayEssence, setDisplayEssence] = useState(initialEssence)
  const [displayTags, setDisplayTags] = useState(initialTags)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/library/characters/${characterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          essence: { personality, appearance, voiceTone, age },
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      })
      if (res.ok) {
        setDisplayName(name)
        setDisplayDesc(description)
        setDisplayEssence({ personality, appearance, voiceTone, age })
        setDisplayTags(tags.split(",").map((t) => t.trim()).filter(Boolean))
        setEditing(false)
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (editing) {
    return (
      <div className="bg-white/5 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Editing character</h2>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} disabled={saving}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 px-3 py-1.5 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Age / Stage</label>
          <input type="text" value={age} onChange={(e) => setAge(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Personality</label>
          <textarea value={personality} onChange={(e) => setPersonality(e.target.value)} rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Appearance</label>
          <textarea value={appearance} onChange={(e) => setAppearance(e.target.value)} rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Voice & tone</label>
          <textarea value={voiceTone} onChange={(e) => setVoiceTone(e.target.value)} rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Tags (comma-separated)</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with edit button */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">{displayName}</h1>
            {displayDesc && <p className="text-white/50 text-sm">{displayDesc}</p>}
          </div>
          <button onClick={() => setEditing(true)}
            className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/70 px-3 py-1.5 rounded-lg transition-colors shrink-0">
            Edit
          </button>
        </div>
        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {displayTags.map((t) => (
              <span key={t} className="text-xs bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full text-white/50">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Essence display */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Character essence</h2>
        {displayEssence.age && (
          <div>
            <p className="text-xs text-white/40 mb-1">Age / Stage</p>
            <p className="text-sm text-white/80">{displayEssence.age}</p>
          </div>
        )}
        {displayEssence.personality && (
          <div>
            <p className="text-xs text-white/40 mb-1">Personality</p>
            <p className="text-sm text-white/80">{displayEssence.personality}</p>
          </div>
        )}
        {displayEssence.appearance && (
          <div>
            <p className="text-xs text-white/40 mb-1">Appearance</p>
            <p className="text-sm text-white/80">{displayEssence.appearance}</p>
          </div>
        )}
        {displayEssence.voiceTone && (
          <div>
            <p className="text-xs text-white/40 mb-1">Voice & tone</p>
            <p className="text-sm text-white/80">{displayEssence.voiceTone}</p>
          </div>
        )}
      </div>
    </div>
  )
}
