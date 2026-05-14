"use client"
// @ts-nocheck

import { useState, useRef, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

interface WinstonMessage {
  role: "user" | "winston"
  text: string
  action?: { id: string; params: Record<string, string> }
}

export function WinstonAssistant() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<WinstonMessage[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = sessionStorage.getItem("winston-messages")
      return stored ? (JSON.parse(stored) as WinstonMessage[]) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    sessionStorage.setItem("winston-messages", JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  async function sendMessage(msg: string) {
    if (!msg.trim() || loading) return
    setMessage("")
    setMessages((prev) => [...prev, { role: "user", text: msg.trim() }])
    setLoading(true)

    try {
      const res = await fetch("/api/ai-assist/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg.trim(),
          pathname,
          history: messages.slice(-8),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const action = data.action ?? undefined
        const isDestructive = action && action.id.startsWith("delete")

        if (action && !isDestructive) {
          // Auto-execute non-destructive actions immediately
          setMessages((prev) => [...prev, { role: "winston", text: data.reply }])
          await confirmAction(action)
        } else {
          setMessages((prev) => [...prev, {
            role: "winston",
            text: data.reply,
            action: isDestructive ? action : undefined,
          }])
        }
        if (data.navigate) {
          router.push(data.navigate)
        }
      } else {
        setMessages((prev) => [...prev, { role: "winston", text: "Hmm, I got a bit tangled up. Try again?" }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: "winston", text: "Oops! Something went wrong." }])
    }
    setLoading(false)
  }

  async function confirmAction(action: { id: string; params: Record<string, string> }) {
    setConfirming(true)
    try {
      const res = await fetch("/api/ai-assist/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmAction: action }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, { role: "winston", text: data.reply }])
        if (data.refresh) {
          // Small delay then refresh to show updated data
          setTimeout(() => router.refresh(), 500)
        }
        if (data.navigate) {
          router.push(data.navigate)
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "winston", text: "The action failed. Try doing it manually." }])
    }
    setConfirming(false)
  }

  return (
    <>
      {/* Collapsed bar */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 bg-amber-900/15 hover:bg-amber-900/25 border-b border-amber-700/20 transition-colors group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/winston.png" alt="Winston" className="w-9 h-9 rounded-full object-cover object-top border border-amber-600/40 group-hover:border-amber-500/60 transition-colors" />
          <div className="flex-1 text-left min-w-0">
            <span className="text-sm text-amber-200/80 group-hover:text-amber-200 transition-colors">
              Need help? Ask Winston
            </span>
          </div>
          <span className="text-xs text-amber-400/40 group-hover:text-amber-400/60 shrink-0 transition-colors">Click to chat</span>
        </button>
      )}

      {/* Expanded chat */}
      {open && (
        <div className="border-b border-white/10 bg-[#12101f]">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-900/20 border-b border-amber-700/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/winston.png" alt="Winston" className="w-8 h-8 rounded-full object-cover object-top border border-amber-600/40" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-200">Winston Wigglesworth</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 text-sm px-2 py-1 rounded hover:bg-white/5 transition-colors">
              Minimize
            </button>
          </div>

          {/* Messages */}
          <div className="max-h-[320px] overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex gap-3 items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/winston.png" alt="Winston" className="w-10 h-10 rounded-full object-cover object-top border border-amber-600/30 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm text-white/70">Hey! I&apos;m Winston, your resident bookworm. I can help you out or handle things for you — just say the word.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {getQuickActions(pathname).map((q) => (
                      <button key={q} onClick={() => sendMessage(q)}
                        className="text-xs bg-white/5 border border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/10 text-white/50 hover:text-white/70 px-2.5 py-1 rounded-full transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "gap-2.5"}`}>
                  {msg.role === "winston" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/winston.png" alt="" className="w-7 h-7 rounded-full object-cover object-top border border-amber-600/20 shrink-0 mt-0.5" />
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : "bg-white/5 text-white/80 border border-white/10 rounded-bl-md"
                  }`}>
                    {msg.text}
                  </div>
                </div>

                {/* Action confirmation button — only show if this is the last message with an action and not yet resolved */}
                {msg.action && i === messages.length - 1 && !messages.some((m, j) => j > i && m.role === "winston") && (
                  <div className="ml-10 mt-2 flex gap-2">
                    <button
                      onClick={() => confirmAction(msg.action!)}
                      disabled={confirming}
                      className="text-xs bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {confirming ? "Working..." : "Yes, do it"}
                    </button>
                    <button
                      onClick={() => setMessages((prev) => [...prev, { role: "winston", text: "No problem, cancelled." }])}
                      className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/winston.png" alt="" className="w-7 h-7 rounded-full object-cover object-top border border-amber-600/20 shrink-0" />
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-3 py-2">
                  <span className="text-white/40 text-sm animate-pulse">thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-2.5 border-t border-white/5">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(message) } }}
                placeholder="Ask Winston anything..."
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={() => sendMessage(message)}
                disabled={loading || !message.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-xl transition-colors shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function getQuickActions(pathname: string): string[] {
  // Rotate between capability-showcasing prompts so users understand breadth
  const universal = [
    "Find me a story I made last week",
    "What characters do I have?",
    "Delete something for me",
  ]

  if (pathname.includes("/characters/new")) return ["Create a brave 8-year-old inventor for me", "What details help images look consistent?", pick(universal)]
  if (pathname.match(/\/characters\/[^/]+$/)) return ["Regenerate this portrait in watercolor", "What could I improve about this character?", pick(universal)]
  if (pathname.includes("/generate")) return ["Pick the best settings for a calm bedtime story", "Write me a story about a lost star", pick(universal)]
  if (pathname.match(/\/stories\/[^/]+$/)) return ["Continue this story", "Save that new character to my library", pick(universal)]
  if (pathname.match(/\/series\/[^/]+$/)) return ["Generate a story with images", "Which characters are linked here?", pick(universal)]
  if (pathname === "/library/characters") return ["Show me all my characters", "Create a new character for me", "Delete a character"]
  if (pathname === "/series") return ["Which series has the most stories?", "Create a new series", pick(universal)]
  if (pathname === "/dashboard") return ["What can you do?", "Walk me through creating my first story", "Find a story for me"]
  return ["What can you do for me?", "Help me make a bedtime story", pick(universal)]
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}
