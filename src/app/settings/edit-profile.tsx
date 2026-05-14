// @ts-nocheck
"use client"

import { useState } from "react"

interface Props {
  initialName: string
  initialEmail: string
}

export function EditProfile({ initialName, initialEmail }: Props) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      if (res.ok) {
        setMessage("Profile updated. Refresh the page to see changes.")
      } else {
        const data = await res.json()
        setError(data.error ?? "Failed to update profile.")
      }
    } catch {
      setError("Something went wrong.")
    }
    setLoading(false)
  }

  const hasChanges = name.trim() !== initialName || email.trim() !== initialEmail

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-xs text-white/40 mb-1">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
      </div>
      <div>
        <label className="block text-xs text-white/40 mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
        <p className="text-[10px] text-white/25 mt-1">Changing your email will require you to log in with the new email next time.</p>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {message && <p className="text-green-400 text-xs">{message}</p>}
      {hasChanges && (
        <button type="submit" disabled={loading}
          className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
          {loading ? "Saving..." : "Save changes"}
        </button>
      )}
    </form>
  )
}
