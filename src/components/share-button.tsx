// @ts-nocheck
"use client"

import { useState } from "react"

interface Props {
  entityType: "series" | "story" | "character" | "world"
  entityId: string
  currentPolicy: string
}

const POLICIES = [
  { value: "PRIVATE", label: "Private", description: "Only you can see this" },
  { value: "UNLISTED", label: "Unlisted", description: "Anyone with the link can view" },
  { value: "PUBLIC_VIEW", label: "Public", description: "Visible on Discover page" },
  { value: "PUBLIC_REUSE", label: "Public + Reusable", description: "Others can copy to their library" },
]

export function ShareButton({ entityType, entityId, currentPolicy }: Props) {
  const [policy, setPolicy] = useState(currentPolicy)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleChange(newPolicy: string) {
    setSaving(true)
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, sharePolicy: newPolicy }),
    })
    if (res.ok) setPolicy(newPolicy)
    setSaving(false)
  }

  function copyLink() {
    const path = entityType === "story" ? `/shared/story/${entityId}`
      : entityType === "character" ? `/shared/character/${entityId}`
      : null
    if (path) {
      navigator.clipboard.writeText(window.location.origin + path)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isShared = policy !== "PRIVATE"

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
          isShared
            ? "bg-green-500/15 border-green-500/30 text-green-300 hover:bg-green-500/25"
            : "bg-white/5 border-white/10 text-white/50 hover:text-white/70"
        }`}>
        {isShared ? "Shared" : "Share"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl w-[260px] p-3 space-y-1">
            {POLICIES.map((p) => (
              <button key={p.value} onClick={() => handleChange(p.value)} disabled={saving}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  policy === p.value ? "bg-indigo-600/20 text-indigo-300" : "text-white/60 hover:bg-white/5"
                }`}>
                <p className="font-medium text-xs">{p.label}</p>
                <p className="text-[10px] text-white/30">{p.description}</p>
              </button>
            ))}

            {isShared && (entityType === "story" || entityType === "character") && (
              <button onClick={copyLink}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-indigo-400 hover:bg-white/5 transition-colors">
                {copied ? "Link copied!" : "Copy share link"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
