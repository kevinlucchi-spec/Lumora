"use client"
// @ts-nocheck

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Character {
  id: string
  name: string
}

interface Props {
  characters: Character[]
}

export function BulkActions({ characters }: Props) {
  const router = useRouter()
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    setDeleting(true)
    for (const id of selected) {
      await fetch(`/api/library/characters/${id}`, { method: "DELETE" })
    }
    setDeleting(false)
    setSelectMode(false)
    setSelected(new Set())
    setConfirm(false)
    router.refresh()
  }

  if (!selectMode) {
    return characters.length > 1 ? (
      <button onClick={() => setSelectMode(true)}
        className="text-xs text-white/30 hover:text-white/50 transition-colors">
        Select multiple
      </button>
    ) : null
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => {
          if (selected.size === characters.length) setSelected(new Set())
          else setSelected(new Set(characters.map((c) => c.id)))
        }} className="text-xs text-white/50 hover:text-white/70 transition-colors">
          {selected.size === characters.length ? "Deselect all" : `Select all (${characters.length})`}
        </button>

        {selected.size > 0 && !confirm && (
          <button onClick={() => setConfirm(true)}
            className="text-xs bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg transition-colors">
            Delete {selected.size} selected
          </button>
        )}

        {confirm && (
          <>
            <span className="text-xs text-red-400">Delete {selected.size} characters?</span>
            <button onClick={handleBulkDelete} disabled={deleting}
              className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {deleting ? "Deleting..." : "Yes, delete"}
            </button>
            <button onClick={() => setConfirm(false)}
              className="text-xs bg-white/5 border border-white/10 text-white/50 px-3 py-1.5 rounded-lg transition-colors">
              Cancel
            </button>
          </>
        )}

        <button onClick={() => { setSelectMode(false); setSelected(new Set()); setConfirm(false) }}
          className="text-xs text-white/30 hover:text-white/50 transition-colors ml-auto">
          Cancel
        </button>
      </div>

      {/* Selection grid */}
      <div className="grid gap-2 sm:grid-cols-2">
        {characters.map((c) => (
          <button key={c.id} onClick={() => toggle(c.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
              selected.has(c.id)
                ? "bg-indigo-600/15 border-indigo-500/40 text-white"
                : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
            }`}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              selected.has(c.id) ? "bg-indigo-600 border-indigo-500" : "border-white/20"
            }`}>
              {selected.has(c.id) && <span className="text-white text-xs">&#10003;</span>}
            </div>
            <span className="text-sm truncate">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
