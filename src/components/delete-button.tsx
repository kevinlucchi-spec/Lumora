"use client"
// @ts-nocheck

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  entityType: string
  entityId: string
  entityName: string
  /** Soft-delete API endpoint (DELETE method) */
  archiveEndpoint: string
}

export function DeleteButton({ entityType, entityId, entityName, archiveEndpoint }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)

    // First, check dependencies to decide hard vs soft delete
    const checkRes = await fetch("/api/admin/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, force: false }),
    })

    if (checkRes.ok) {
      const report = await checkRes.json()

      if (report.canHardDelete) {
        // No dependencies — hard delete permanently
        await fetch("/api/admin/hard-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId, force: true }),
        })
      } else {
        // Has dependencies — soft delete (archive)
        await fetch(archiveEndpoint, { method: "DELETE" })
      }
    } else {
      // Fallback to soft delete
      await fetch(archiveEndpoint, { method: "DELETE" })
    }

    setLoading(false)
    setConfirming(false)
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
        <span className="text-xs text-red-400">Delete {entityName}?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-2 py-1 rounded transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs bg-white/5 hover:bg-white/10 text-white/40 px-2 py-1 rounded transition-colors"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); setConfirming(true) }}
      className="text-xs text-white/20 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
      title={`Delete ${entityName}`}
    >
      Delete
    </button>
  )
}
