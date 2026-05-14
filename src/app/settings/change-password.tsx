"use client"
// @ts-nocheck

import { useState } from "react"

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.ok) {
        setMessage("Password changed successfully.")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        const data = await res.json()
        setError(data.error ?? "Failed to change password.")
      }
    } catch {
      setError("Something went wrong.")
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-white/40 mb-1">Current password</label>
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
      </div>
      <div>
        <label className="block text-xs text-white/40 mb-1">New password</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
      </div>
      <div>
        <label className="block text-xs text-white/40 mb-1">Confirm new password</label>
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {message && <p className="text-green-400 text-xs">{message}</p>}
      <button type="submit" disabled={loading}
        className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
        {loading ? "Changing..." : "Change password"}
      </button>
    </form>
  )
}
