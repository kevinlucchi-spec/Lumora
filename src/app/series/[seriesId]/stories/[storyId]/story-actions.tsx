"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  seriesId: string
  storyId: string
  storyTitle: string
}

export function StoryActions({ seriesId, storyId, storyTitle }: Props) {
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const checkRes = await fetch("/api/admin/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "story", entityId: storyId, force: false }),
    })
    if (checkRes.ok) {
      const report = await checkRes.json()
      if (report.canHardDelete) {
        await fetch("/api/admin/hard-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "story", entityId: storyId, force: true }),
        })
      } else {
        await fetch(`/api/series/${seriesId}/stories/${storyId}`, { method: "DELETE" })
      }
    } else {
      await fetch(`/api/series/${seriesId}/stories/${storyId}`, { method: "DELETE" })
    }
    router.push(`/series/${seriesId}`)
  }

  async function handleExportPDF() {
    setExporting(true)
    try {
      const res = await fetch(`/api/series/${seriesId}/stories/${storyId}/export-pdf`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${storyTitle.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-")}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch { /* ignore */ }
    setExporting(false)
  }

  return (
    <>
      <div className="mt-16 pt-8 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href={`/series/${seriesId}`}
              className="text-sm text-white/40 hover:text-white transition-colors">
              &larr; Back to series
            </a>
            <button onClick={handleExportPDF} disabled={exporting}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/70 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
              {exporting ? "Exporting..." : "Export PDF"}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-white/20 hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10">
              Delete story
            </button>
            <a href={`/series/${seriesId}/generate?continueFrom=${storyId}`}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Continue this story
            </a>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-[400px] space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-medium">Delete story?</h3>
            <p className="text-white/50 text-sm">
              &ldquo;{storyTitle}&rdquo; will be permanently removed. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 rounded-lg text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
                {deleting ? "Deleting..." : "Delete story"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
