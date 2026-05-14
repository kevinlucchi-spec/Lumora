"use client"
// @ts-nocheck

import { useState, useEffect } from "react"

interface PortraitItem {
  id: string
  name: string
  url: string
  provider: string
  source: string
  createdAt: string
  characterName: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (portrait: PortraitItem & { _action?: string }) => void
}

export function PortraitLibraryModal({ open, onClose, onSelect }: Props) {
  const [portraits, setPortraits] = useState<PortraitItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PortraitItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSelected(null)
    setDeleteConfirm(null)
    fetch("/api/library/portraits")
      .then((r) => r.json())
      .then((d) => setPortraits(d.portraits ?? []))
      .catch(() => setPortraits([]))
      .finally(() => setLoading(false))
  }, [open])

  async function handleDelete(portraitId: string) {
    setDeleting(true)
    try {
      await fetch("/api/library/portraits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portraitId }),
      })
      setPortraits((prev) => prev.filter((p) => p.id !== portraitId))
      setDeleteConfirm(null)
      if (selected?.id === portraitId) setSelected(null)
    } catch { /* ignore */ }
    setDeleting(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-[720px] max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Portrait Library</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg transition-colors">&times;</button>
        </div>

        {/* Detail view */}
        {selected ? (
          <div className="flex-1 overflow-y-auto p-6">
            {deleteConfirm === selected.id ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center space-y-4">
                <h3 className="text-white font-medium">Delete portrait?</h3>
                <p className="text-white/50 text-sm">This will remove this image from your portrait library. This action cannot be undone.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 rounded-lg text-sm transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => handleDelete(selected.id)} disabled={deleting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
                    {deleting ? "Deleting..." : "Delete portrait"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.url} alt={selected.name}
                  className="w-full max-w-sm mx-auto aspect-square rounded-xl object-cover border border-white/10" />
                <div className="text-center space-y-1">
                  <p className="text-white font-medium">{selected.name}</p>
                  <p className="text-white/40 text-xs">
                    {selected.source} &middot; {new Date(selected.createdAt).toLocaleDateString()}
                    {selected.characterName && <> &middot; {selected.characterName}</>}
                  </p>
                </div>
                <div className="flex gap-2 justify-center pt-2">
                  <button onClick={() => { onSelect(selected); onClose() }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
                    Use as is
                  </button>
                  <button onClick={() => { onSelect({ ...selected, _action: "edit" }); onClose() }}
                    className="px-5 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-lg text-sm transition-colors">
                    Edit with AI
                  </button>
                  <button onClick={() => setDeleteConfirm(selected.id)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-red-500/10 border border-white/10 text-white/40 hover:text-red-400 rounded-lg text-sm transition-colors">
                    Delete
                  </button>
                </div>
                <button onClick={() => setSelected(null)}
                  className="block mx-auto text-xs text-white/30 hover:text-white/50 transition-colors mt-2">
                  Back to library
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Grid view */
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <p className="text-white/30 text-sm text-center py-8">Loading portraits...</p>
            ) : portraits.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">No portraits yet. Generate one to get started.</p>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {portraits.map((p) => (
                  <button key={p.id} onClick={() => setSelected(p)}
                    className="group text-left bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-colors">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.name}
                      className="w-full aspect-square object-cover" />
                    <div className="px-3 py-2">
                      <p className="text-xs text-white/70 truncate">{p.name}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
