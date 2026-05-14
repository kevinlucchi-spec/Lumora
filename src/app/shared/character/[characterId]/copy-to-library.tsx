// @ts-nocheck
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  characterId: string
  characterName: string
}

export function CopyToLibrary({ characterId, characterName }: Props) {
  const router = useRouter()
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    setCopying(true)
    try {
      const res = await fetch("/api/share/copy-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      })
      if (res.ok) {
        setCopied(true)
        router.refresh()
      }
    } catch { /* ignore */ }
    setCopying(false)
  }

  if (copied) {
    return <p className="text-green-400 text-sm mt-4">Added to your library!</p>
  }

  return (
    <button onClick={handleCopy} disabled={copying}
      className="mt-4 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
      {copying ? "Copying..." : `Add ${characterName} to my library`}
    </button>
  )
}
