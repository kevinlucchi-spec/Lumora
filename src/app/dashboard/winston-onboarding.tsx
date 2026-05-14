"use client"
// @ts-nocheck

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface Props {
  userName: string
  userId: string
}

type Step = "welcome" | "age-band" | "character-input" | "character-creating" | "portrait-style" | "portrait-creating" | "world-input" | "world-creating" | "series-input" | "series-creating" | "all-done"

const AGE_BANDS = [
  { value: "TODDLER", label: "Toddler", sub: "2–3 years" },
  { value: "EARLY", label: "Early", sub: "4–6 years" },
  { value: "MIDDLE", label: "Middle", sub: "7–9 years" },
  { value: "TWEEN", label: "Tween", sub: "10–12 years" },
  { value: "PRETEEN", label: "Preteen", sub: "12+ years" },
]

interface State {
  step: Step
  ageBand?: string
  characterId?: string
  characterName?: string
  artStyle?: string
  portraitUrl?: string
  worldId?: string
  worldName?: string
  seriesId?: string
  seriesName?: string
}

const ART_STYLES = [
  { value: "warm digital illustration, rounded forms, modern children's book style", label: "Modern Storybook" },
  { value: "traditional watercolor on textured paper, visible brushstrokes, soft edges", label: "Watercolor" },
  { value: "Japanese anime cel animation style, sharp outlines, large glossy eyes, Studio Ghibli feel", label: "Anime / Ghibli" },
  { value: "photorealistic 3D render, ray-traced lighting, Pixar-quality rendering", label: "Photorealistic 3D" },
  { value: "pencil and charcoal sketch on cream paper, crosshatching, hand-drawn feel", label: "Pencil Sketch" },
  { value: "oil painting with thick brushstrokes, rich colors, warm golden light, classical storybook", label: "Oil Painting" },
  { value: "kawaii chibi style, round proportions, oversized head, pastel candy colors", label: "Chibi / Kawaii" },
  { value: "1950s golden age picture book, grainy lithograph texture, muted earth tones", label: "Vintage / Retro" },
]

function load(userId: string): State {
  if (typeof window === "undefined") return { step: "welcome" }
  try {
    const raw = localStorage.getItem("lumora-onboarding")
    if (!raw) return { step: "welcome" }
    const s = JSON.parse(raw)
    // Clear if different user
    if (s._userId && s._userId !== userId) {
      localStorage.removeItem("lumora-onboarding")
      return { step: "welcome" }
    }
    return s
  } catch { return { step: "welcome" } }
}
function save(s: State, userId: string) { try { localStorage.setItem("lumora-onboarding", JSON.stringify({ ...s, _userId: userId })) } catch {} }
function clear() { try { localStorage.removeItem("lumora-onboarding") } catch {} }

export function WinstonOnboarding({ userName, userId }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>(() => load(userId))
  const [input, setInput] = useState("")
  const [selectedStyle, setSelectedStyle] = useState("")
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const stepOrder: Step[] = ["welcome", "age-band", "character-input", "portrait-style", "world-input", "series-input", "all-done"]
  function goBack() {
    // Find the previous navigable step (skip creating/loading steps)
    const currentIdx = stepOrder.indexOf(state.step)
    // Handle "creating" steps — map them back to their input step
    const mappedStep: Step =
      state.step === "character-creating" ? "character-input" :
      state.step === "portrait-creating" ? "portrait-style" :
      state.step === "world-creating" ? "world-input" :
      state.step === "series-creating" ? "series-input" :
      state.step
    const idx = stepOrder.indexOf(mappedStep)
    if (idx > 0) up({ step: stepOrder[idx - 1] })
  }
  const canGoBack = state.step !== "welcome" && !loading && !state.step.endsWith("-creating")

  useEffect(() => { save(state, userId) }, [state, userId])
  function up(patch: Partial<State>) { setState((prev) => ({ ...prev, ...patch })) }

  async function callWinston(message: string) {
    const res = await fetch("/api/ai-assist/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, pathname: "/dashboard", history: [] }) })
    return res.ok ? res.json() : null
  }
  async function execAction(action: { id: string; params: Record<string, string> }) {
    const res = await fetch("/api/ai-assist/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmAction: action }) })
    return res.ok ? res.json() : null
  }

  async function createCharacter(userInput?: string) {
    const desc = userInput ?? input.trim()
    setLoading(true); up({ step: "character-creating" })
    const ageContext = state.ageBand ? `The target audience is ${state.ageBand} (${AGE_BANDS.find(a => a.value === state.ageBand)?.sub ?? ""}). Create a character appropriate for this age group.` : ""
    const prompt = desc
      ? `Create a character based on: "${desc}". ${ageContext} Include detailed appearance, personality, voice tone, and age.`
      : `Create a fun, TRULY UNIQUE bedtime story character. ${ageContext}

IMPORTANT: Be creative and varied. Characters can be ANYTHING — humans, animals, objects, plants, weather, food, mythical creatures, or abstract concepts brought to life. Don't default to foxes or woodland animals every time. Rotate widely. Here are examples of the range I want:
- A human child with a unique quirk or ability
- A sentient teapot, a dancing cactus, a retired superhero goldfish
- A cloud who is afraid of heights, a pair of mismatched socks on adventures
- A fox, bear, or owl is fine too — just not every time

Pick something fresh and unexpected. Include detailed appearance, personality, voice tone, and specific age (or equivalent for non-human characters).`
    const data = await callWinston(prompt)
    if (data?.action) {
      const result = await execAction(data.action)
      let charId = result?.navigate?.match(/\/characters\/([^/]+)/)?.[1]
      // Fallback: if ID not captured from navigate, fetch the most recent character
      if (!charId) {
        try {
          const res = await fetch("/api/library/characters")
          if (res.ok) {
            const chars = await res.json()
            if (Array.isArray(chars) && chars.length > 0) charId = chars[0].id
          }
        } catch { /* ignore */ }
      }
      up({ step: "portrait-style", characterId: charId, characterName: data.action.params.name ?? "Your character" })
    } else {
      up({ step: "portrait-style", characterName: "Your character" })
    }
    setLoading(false); setInput("")
  }

  async function generatePortrait() {
    if (!state.characterId) { up({ step: "world-input" }); return }
    setLoading(true); up({ step: "portrait-creating", artStyle: selectedStyle })
    try {
      const res = await fetch(`/api/library/characters/${state.characterId}/portrait`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artStyle: selectedStyle || undefined }),
      })
      if (res.ok) { const d = await res.json(); up({ step: "world-input", portraitUrl: d.url }) }
      else up({ step: "world-input" })
    } catch { up({ step: "world-input" }) }
    setLoading(false)
  }

  async function createWorld(userInput?: string) {
    const desc = userInput ?? input.trim()
    setLoading(true); up({ step: "world-creating" })
    const worldName = desc || `${state.characterName}'s World`
    const prompt = desc
      ? `Create a world called "${desc}" suitable for bedtime stories. Include rules and tone guide.`
      : `Create a cozy, magical world for ${state.characterName}'s bedtime stories. Pick a creative name, include rules and tone guide.`
    const data = await callWinston(prompt)
    if (data?.action) {
      const result = await execAction(data.action)
      up({ step: "series-input", worldId: result?.worldId, worldName: data.action.params.name ?? worldName })
    } else {
      up({ step: "series-input", worldName })
    }
    setLoading(false); setInput("")
  }

  async function createSeries(userInput?: string) {
    const name = userInput ?? input.trim()
    setLoading(true); up({ step: "series-creating" })
    const finalName = name || `${state.characterName}'s Adventures`
    const result = await execAction({ id: "create-series", params: { name: finalName } })
    const sId = result?.navigate?.match(/\/series\/([^/]+)/)?.[1]
    if (sId) {
      if (state.characterId) {
        await execAction({ id: "link-character", params: { seriesId: sId, characterId: state.characterId } })
      }
      if (state.worldId) {
        await execAction({ id: "link-world", params: { seriesId: sId, worldId: state.worldId } })
      }
    }
    up({ step: "all-done", seriesId: sId, seriesName: finalName })
    setLoading(false); setInput("")
  }

  function finish() { clear(); state.seriesId ? router.push(`/series/${state.seriesId}`) : router.refresh() }
  function skip() { clear(); setDismissed(true) }

  if (dismissed) return (
    <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center">
      <p className="text-white/50 text-sm mb-4">No series yet. Create one to get started!</p>
    </div>
  )

  const stepNum: Record<Step, number> = {
    welcome: 1, "age-band": 2,
    "character-input": 3, "character-creating": 3,
    "portrait-style": 4, "portrait-creating": 4,
    "world-input": 5, "world-creating": 5,
    "series-input": 6, "series-creating": 6, "all-done": 7,
  }

  return (
    <div className="bg-amber-900/10 border border-amber-700/20 rounded-2xl p-8">
      <div className="flex gap-4 items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/winston.png" alt="Winston" className="w-14 h-14 rounded-full object-cover object-top border border-amber-600/40 shrink-0" />
        <div className="flex-1 space-y-4">

          {state.step === "welcome" && <>
            <p className="text-white/80 text-sm leading-relaxed">Hey {userName}! I&apos;m Winston, your resident bookworm. Let me help you set up your first story — we&apos;ll pick an audience, create a character, build a world, and set up a series. Takes about a minute.</p>
            <div className="flex gap-2">
              <button onClick={() => up({ step: "age-band" })} className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors">Let&apos;s get started</button>
              <button onClick={skip} className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 px-4 py-2 rounded-lg transition-colors">I&apos;ll explore on my own</button>
            </div>
          </>}

          {state.step === "age-band" && <>
            <p className="text-white/80 text-sm leading-relaxed">First — who are these stories for? This helps me create age-appropriate characters and stories.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AGE_BANDS.map((a) => (
                <button key={a.value} onClick={() => up({ step: "character-input", ageBand: a.value })}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-left hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white/80">{a.label}</p>
                    <p className="text-xs text-white/40">{a.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </>}

          {state.step === "character-input" && <>
            <p className="text-white/80 text-sm leading-relaxed">First, your main character. Describe them in a sentence or two, or I can surprise you.</p>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. A shy 6-year-old boy with red curly hair who loves collecting bugs and wears rain boots everywhere" rows={3} maxLength={500} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); createCharacter() } }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
            <div className="flex gap-2">
              <button onClick={() => createCharacter()} disabled={!input.trim() || loading} className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">Create this character</button>
              <button onClick={() => createCharacter("")} disabled={loading} className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/70 px-4 py-2 rounded-lg transition-colors">Surprise me</button>
            </div>
          </>}

          {state.step === "character-creating" && <Loading text="Winston is crafting your character..." />}

          {state.step === "portrait-style" && <>
            <p className="text-white/80 text-sm leading-relaxed"><strong>{state.characterName}</strong> is created! Now pick an art style for their portrait — this will also be the default for story illustrations.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ART_STYLES.map((s) => (
                <button key={s.value} onClick={() => setSelectedStyle(s.value)}
                  className={`text-xs px-3 py-2.5 rounded-xl border text-center transition-colors ${selectedStyle === s.value ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={generatePortrait} disabled={loading || !selectedStyle} className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">Generate portrait</button>
              <button onClick={() => up({ step: "world-input" })} className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 px-4 py-2 rounded-lg transition-colors">Skip portrait</button>
            </div>
          </>}

          {state.step === "portrait-creating" && <Loading text={`Generating ${state.characterName}'s portrait...`} />}

          {state.step === "world-input" && <>
            {state.portraitUrl && (
              <div className="flex items-center gap-4 mb-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.portraitUrl} alt={state.characterName ?? ""} className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                <p className="text-white/60 text-sm">Looking good!</p>
              </div>
            )}
            <p className="text-white/80 text-sm leading-relaxed">Now let&apos;s build a world for {state.characterName}&apos;s stories. Describe the setting, or let me create one.</p>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. A cozy village at the edge of a whispering forest where animals can talk after sunset" rows={2} maxLength={500} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); createWorld() } }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
            <div className="flex gap-2">
              <button onClick={() => createWorld()} disabled={!input.trim() || loading} className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">Create this world</button>
              <button onClick={() => createWorld("")} disabled={loading} className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/70 px-4 py-2 rounded-lg transition-colors">Build one for me</button>
              <button onClick={() => up({ step: "series-input" })} className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/30 px-4 py-2 rounded-lg transition-colors">Skip</button>
            </div>
          </>}

          {state.step === "world-creating" && <Loading text="Building your world..." />}

          {state.step === "series-input" && <>
            <p className="text-white/80 text-sm leading-relaxed">Almost there! Let&apos;s name your story series — all of {state.characterName}&apos;s adventures will live here.</p>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`e.g. "${state.characterName}'s Adventures"`} maxLength={200} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createSeries() } }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500 transition-colors" />
            <div className="flex gap-2">
              <button onClick={() => createSeries()} disabled={!input.trim() || loading} className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">Create series</button>
              <button onClick={() => createSeries("")} disabled={loading} className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/70 px-4 py-2 rounded-lg transition-colors">Pick a name for me</button>
            </div>
          </>}

          {state.step === "series-creating" && <Loading text={`Setting up your series and linking ${state.characterName}...`} />}

          {state.step === "all-done" && <>
            <p className="text-white/80 text-sm leading-relaxed">You&apos;re all set! <strong>{state.characterName}</strong> is linked to <strong>{state.seriesName}</strong>{state.worldName ? ` in the world of ${state.worldName}` : ""}. Head to your series to generate your first bedtime story.</p>
            <button onClick={finish} className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors">Go to my series</button>
          </>}

          {/* Navigation + Progress */}
          <div className="flex items-center gap-3 pt-1">
            {canGoBack && (
              <button onClick={goBack} className="text-xs text-white/30 hover:text-white/50 transition-colors shrink-0">&larr; Back</button>
            )}
            <div className="flex gap-1.5 flex-1">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <div key={n} className={`h-1 rounded-full transition-all duration-300 ${n <= stepNum[state.step] ? "bg-amber-500 flex-[2]" : "bg-white/10 flex-1"}`} />
              ))}
            </div>
            {state.step !== "welcome" && !loading && (
              <button onClick={() => { clear(); setState({ step: "welcome" }) }} className="text-xs text-white/20 hover:text-white/40 transition-colors shrink-0">Start over</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
      <p className="text-amber-300/70 text-sm">{text}</p>
    </div>
  )
}
