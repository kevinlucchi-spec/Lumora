"use client"
// @ts-nocheck

import { useState } from "react"

interface SupportingCharacter {
  name: string
  role: string
  primary_trait: string
  secondary_trait?: string
  emotional_function: string
  appearance: string
  voice_tone: string
}

interface Props {
  seriesId: string
  storyId: string
  supportingCharacters: SupportingCharacter[]
  /** Names of characters already in the library — hide these from the prompt */
  existingCharacterNames?: string[]
}

export function NewElementsPrompt({ seriesId, storyId, supportingCharacters, existingCharacterNames = [] }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)

  if (dismissed || supportingCharacters.length === 0) return null

  const existingLower = new Set(existingCharacterNames.map((n) => n.toLowerCase()))
  const unsaved = supportingCharacters.filter((c) => !saved.has(c.name) && !existingLower.has(c.name.toLowerCase()))
  if (unsaved.length === 0) return null

  async function handleSave(char: SupportingCharacter) {
    setSaving(char.name)
    try {
      // Build a visual profile from the appearance description
      const visualProfile = buildVisualProfileFromAppearance(char)

      const res = await fetch("/api/library/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: char.name,
          description: `${char.role}. ${char.primary_trait}${char.secondary_trait ? `, ${char.secondary_trait}` : ""}.`,
          essence: {
            personality: char.primary_trait + (char.secondary_trait ? `, ${char.secondary_trait}` : ""),
            appearance: char.appearance,
            voiceTone: char.voice_tone,
          },
          visualProfile,
          tags: [char.role, char.emotional_function].filter(Boolean),
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setSaved((prev) => new Set([...prev, char.name]))

        // Link to the series
        try {
          await fetch(`/api/series/${seriesId}/characters`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterTemplateId: created.id }),
          })
        } catch { /* non-critical */ }

        // Try to find a scene image featuring this character and extract a portrait
        try {
          const sceneRes = await fetch(`/api/series/${seriesId}/stories/${storyId}/character-image?name=${encodeURIComponent(char.name)}`)
          if (sceneRes.ok) {
            const sceneData = await sceneRes.json()
            if (sceneData.imageUrl) {
              // Extract a portrait-framed image of just this character from the scene
              await fetch(`/api/library/characters/${created.id}/portrait/extract`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sceneImageUrl: sceneData.imageUrl }),
              })
            }
          }
        } catch { /* portrait extraction is best-effort */ }
      }
    } catch { /* ignore */ }
    setSaving(null)
  }

  return (
    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6 mt-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-indigo-300">New characters found</h3>
          <p className="text-xs text-white/40 mt-0.5">Characters from this story can be saved to your library for reuse.</p>
        </div>
        <button onClick={() => setDismissed(true)}
          className="text-xs text-white/30 hover:text-white/50 transition-colors">
          Dismiss
        </button>
      </div>
      <div className="space-y-3">
        {unsaved.map((char) => (
          <div key={char.name} className="flex items-start gap-4 bg-white/5 rounded-xl px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 font-medium">{char.name}</p>
              <p className="text-xs text-white/40 mt-0.5">{char.role} &middot; {char.primary_trait}</p>
              {char.appearance && <p className="text-xs text-white/30 mt-0.5">{char.appearance}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => handleSave(char)} disabled={saving === char.name}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                {saving === char.name ? "Saving..." : "Save to library"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Parse the free-text appearance into a structured visual profile */
function buildVisualProfileFromAppearance(char: SupportingCharacter): Record<string, unknown> {
  const desc = char.appearance ?? ""

  return {
    physicalDescription: {
      species: "human",
      build: extractTrait(desc, /\b(lanky|stocky|slim|small|tall|large|petite|sturdy|wiry)\b/i),
      skinTone: extractTrait(desc, /([\w\s]+ skin)/i),
      hairColor: extractTrait(desc, /([\w\s]+ hair|braid|curls?)/i),
      eyeColor: extractTrait(desc, /([\w\s]+ eyes)/i),
    },
    clothingDefaults: {
      outfit: desc,
      accessories: [],
      colors: [],
    },
    distinguishingFeatures: desc ? [desc] : [],
    artStyleNotes: "",
  }
}

function extractTrait(text: string, pattern: RegExp): string {
  const match = text.match(pattern)
  return match ? match[0].trim() : ""
}
