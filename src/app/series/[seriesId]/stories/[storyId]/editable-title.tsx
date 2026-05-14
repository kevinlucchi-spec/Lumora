"use client"
// @ts-nocheck

import { useState, useRef, useEffect } from "react"

interface Props {
  storyId: string
  seriesId: string
  initialTitle: string
}

export function EditableTitle({ storyId, seriesId, initialTitle }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  async function save() {
    const trimmed = title.trim()
    if (!trimmed || trimmed === initialTitle) {
      setTitle(initialTitle)
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await fetch(`/api/series/${seriesId}/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      })
    } catch { /* ignore */ }
    setSaving(false)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); save() }
    if (e.key === "Escape") { setTitle(initialTitle); setEditing(false) }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="text" value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          maxLength={200}
          disabled={saving}
          className="flex-1 text-3xl font-bold bg-transparent border-b-2 border-indigo-500 text-white outline-none py-1" />
      </div>
    )
  }

  return (
    <h1 className="text-3xl font-bold leading-tight group cursor-pointer" onClick={() => setEditing(true)}
      title="Click to rename">
      {title}
      <span className="text-white/20 group-hover:text-white/40 text-sm ml-2 transition-colors">edit</span>
    </h1>
  )
}
