"use client"
// @ts-nocheck

import { useState, useRef } from "react"
import { PortraitLibraryModal } from "@/components/portrait-library-modal"

interface Props {
  characterId: string
  initialPortraitUrl: string | null
  initialPortraitName: string | null
  hasAppearance: boolean
}

export function CharacterPortraitPanel({ characterId, initialPortraitUrl, initialPortraitName, hasAppearance }: Props) {
  const [portraitUrl, setPortraitUrl] = useState(initialPortraitUrl)
  const [portraitName, setPortraitName] = useState(initialPortraitName)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editInstruction, setEditInstruction] = useState("")
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [error, setError] = useState("")
  const [artStyle, setArtStyle] = useState("")
  const [customStyle, setCustomStyle] = useState("")
  const [showStylePicker, setShowStylePicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const PORTRAIT_STYLES = [
    { value: "", label: "Default" },
    { value: "traditional watercolor on textured cold-press paper, visible brushstrokes, paint bleeds and soft edges, muted washed-out pigments", label: "Watercolor" },
    { value: "clean vector-style digital illustration, smooth gradients, rounded friendly shapes, vivid saturated colors, modern children's book", label: "Modern Storybook" },
    { value: "Japanese anime cel animation style, sharp clean outlines, flat color fills with dramatic shading, large glossy eyes, Studio Ghibli detail", label: "Anime / Ghibli" },
    { value: "1950s golden age picture book, grainy lithograph texture, limited muted color palette of ochre rust sage and cream, retro feel", label: "Vintage / Retro" },
    { value: "photorealistic 3D render, subsurface skin scattering, ray-traced lighting, shallow depth of field, Pixar-quality rendering", label: "Photorealistic 3D" },
    { value: "loose pencil and charcoal sketch on cream paper, crosshatching for shadows, no color, visible eraser marks, raw and expressive", label: "Pencil Sketch" },
    { value: "oil painting with thick impasto brushstrokes, rich deep colors, warm golden light, classical storybook fairy tale feel", label: "Oil Painting" },
    { value: "kawaii chibi style, extremely round simplified proportions, tiny body with oversized head, pastel candy colors, cute Japanese aesthetic", label: "Chibi / Kawaii" },
  ]

  async function handleGenerate() {
    setError("")
    setGenerating(true)
    try {
      const res = await fetch(`/api/library/characters/${characterId}/portrait`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artStyle: artStyle || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to generate portrait")
      }
      const data = await res.json()
      setPortraitUrl(data.url)
      setPortraitName(data.name ?? "Generated portrait")
    } catch (err) {
      setError((err as Error).message)
    }
    setGenerating(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError("")
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/library/characters/${characterId}/portrait/upload`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Upload failed")
      }
      const data = await res.json()
      setPortraitUrl(data.url)
      setPortraitName(data.name ?? "Uploaded portrait")
    } catch (err) {
      setError((err as Error).message)
    }
    setUploading(false)
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleEdit() {
    if (!editInstruction.trim()) return
    setError("")
    setSubmittingEdit(true)
    try {
      const res = await fetch(`/api/library/characters/${characterId}/portrait/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editInstruction: editInstruction.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Edit failed")
      }
      const data = await res.json()
      setPortraitUrl(data.url)
      setPortraitName(data.name ?? "Edited portrait")
      setEditing(false)
      setEditInstruction("")
    } catch (err) {
      setError((err as Error).message)
    }
    setSubmittingEdit(false)
  }

  async function handleRemove() {
    await fetch(`/api/library/characters/${characterId}/portrait`, { method: "DELETE" })
    setPortraitUrl(null)
    setPortraitName(null)
    setEditing(false)
    setEditInstruction("")
    setDeleteConfirm(false)
  }

  function handleLibrarySelect(portrait: { id: string; url: string; name: string; _action?: string }) {
    if (portrait._action === "edit") {
      assignPortrait(portrait.id, portrait.url, portrait.name)
      setEditing(true)
    } else {
      assignPortrait(portrait.id, portrait.url, portrait.name)
    }
  }

  async function assignPortrait(portraitId: string, url: string, name: string) {
    setPortraitUrl(url)
    setPortraitName(name)
    await fetch(`/api/library/characters/${characterId}/portrait`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portraitAssetId: portraitId }),
    })
  }

  const busy = generating || uploading

  // Hidden file input for upload
  const fileInput = (
    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif"
      onChange={handleUpload} className="hidden" />
  )

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-[280px] shrink-0">
      <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Portrait</h2>
      {fileInput}

      {portraitUrl ? (
        /* ── Has portrait ── */
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portraitUrl} alt={portraitName ?? "Character portrait"}
            className="w-full rounded-xl object-contain border border-white/10 max-h-[320px]" />

          {portraitName && (
            <p className="text-xs text-white/50 text-center truncate">{portraitName}</p>
          )}

          {/* Edit with AI panel */}
          {editing ? (
            <div className="space-y-2">
              <textarea value={editInstruction} onChange={(e) => setEditInstruction(e.target.value)}
                placeholder="e.g. Make the eyes greener, add a wizard hat, change to nighttime..."
                rows={3} maxLength={500}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/25 text-xs focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
              <div className="flex gap-2">
                <button onClick={handleEdit} disabled={submittingEdit || !editInstruction.trim()}
                  className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-2 rounded-lg transition-colors">
                  {submittingEdit ? "Editing..." : "Apply edit"}
                </button>
                <button onClick={() => { setEditing(false); setEditInstruction("") }}
                  className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 px-3 py-2 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : deleteConfirm ? (
            /* Delete confirmation */
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
              <p className="text-xs text-white/70 font-medium">Delete portrait?</p>
              <p className="text-[10px] text-white/40">This will remove this image from your portrait library. This action cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(false)}
                  className="flex-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 py-1.5 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleRemove}
                  className="flex-1 text-xs bg-red-600 hover:bg-red-500 text-white py-1.5 rounded-lg transition-colors">
                  Delete portrait
                </button>
              </div>
            </div>
          ) : (
            /* Action buttons — Edit with AI, Regenerate, Add from library, Upload */
            <div className="space-y-2">
              {/* Art style picker for regeneration */}
              {showStylePicker && (
                <div className="space-y-2">
                  <p className="text-[10px] text-white/40">Pick a style, then regenerate:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PORTRAIT_STYLES.map((s) => (
                      <button key={s.value} type="button" onClick={() => { setArtStyle(s.value); setCustomStyle("") }}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                          artStyle === s.value && !customStyle ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                        }`}>{s.label}</button>
                    ))}
                  </div>
                  <input type="text" value={customStyle} onChange={(e) => { setCustomStyle(e.target.value); if (e.target.value) setArtStyle(e.target.value) }}
                    placeholder="Or describe your own style..."
                    maxLength={300}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-white/25 text-[11px] focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)}
                  className="flex-1 text-xs bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 py-2 rounded-lg transition-colors">
                  Edit with AI
                </button>
                <button onClick={() => { if (showStylePicker) { handleGenerate() } else { setShowStylePicker(true) } }} disabled={busy || !hasAppearance}
                  className="flex-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 py-2 rounded-lg transition-colors disabled:opacity-40">
                  {generating ? "..." : showStylePicker ? "Generate" : "Regenerate"}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setLibraryOpen(true)}
                  className="flex-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 py-2 rounded-lg transition-colors">
                  Add from library
                </button>
                <button onClick={() => fileInputRef.current?.click()} disabled={busy}
                  className="flex-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 py-2 rounded-lg transition-colors disabled:opacity-40">
                  {uploading ? "..." : "Upload"}
                </button>
              </div>
              <button onClick={() => setDeleteConfirm(true)}
                className="w-full text-xs bg-white/5 hover:bg-red-500/10 border border-white/10 text-white/30 hover:text-red-400 py-1.5 rounded-lg transition-colors">
                Remove portrait
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── Empty state: Generate, Add from library, Upload ── */
        <div className="space-y-2">
          <button onClick={() => hasAppearance ? (showStylePicker ? handleGenerate() : setShowStylePicker(true)) : undefined}
            disabled={busy || !hasAppearance}
            className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-white/10 hover:border-indigo-500/50 flex flex-col items-center justify-center gap-2 transition-colors disabled:opacity-40 group"
            title={hasAppearance ? "Generate a portrait with AI" : "Add an appearance description first"}>
            {generating ? (
              <span className="text-white/40 text-sm">Generating...</span>
            ) : showStylePicker ? (
              <span className="text-xs text-indigo-300">Click to generate</span>
            ) : (
              <>
                <span className="text-3xl text-white/15 group-hover:text-indigo-400 transition-colors">+</span>
                <span className="text-xs text-white/20 group-hover:text-white/40 transition-colors">Generate new</span>
              </>
            )}
          </button>
          {showStylePicker && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {PORTRAIT_STYLES.map((s) => (
                  <button key={s.value} type="button" onClick={() => { setArtStyle(s.value); setCustomStyle("") }}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                      artStyle === s.value && !customStyle ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                    }`}>{s.label}</button>
                ))}
              </div>
              <input type="text" value={customStyle} onChange={(e) => { setCustomStyle(e.target.value); if (e.target.value) setArtStyle(e.target.value) }}
                placeholder="Or describe your own style..."
                maxLength={300}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-white/25 text-[11px] focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setLibraryOpen(true)}
              className="flex-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 py-2.5 rounded-lg transition-colors">
              Add from library
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={busy}
              className="flex-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 py-2.5 rounded-lg transition-colors disabled:opacity-40">
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      <PortraitLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={handleLibrarySelect}
      />
    </div>
  )
}
