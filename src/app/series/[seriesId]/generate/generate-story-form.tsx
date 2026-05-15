"use client"
// @ts-nocheck

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { CustomSelect } from "@/components/custom-select"

const MODES = [
  { value: "CALM_BEDTIME", label: "Calm bedtime", description: "Gentle, sleepy \u2014 winds down the night" },
  { value: "COZY_ADVENTURE", label: "Cozy adventure", description: "Light excitement, safe outcomes" },
  { value: "MORAL_LESSON", label: "Moral lesson", description: "Teaches a value through story" },
  { value: "DREAMLIKE", label: "Dreamlike", description: "Surreal, imaginative, wonder-filled" },
  { value: "SIBLING_FAMILY", label: "Sibling & family", description: "Focuses on family dynamics" },
  { value: "WHAT_IF_BRANCH", label: "What if\u2026", description: "Explores an alternate path" },
] as const

const AGE_BANDS = [
  { value: "TODDLER", label: "Toddler", sub: "2\u20133 yrs" },
  { value: "EARLY", label: "Early", sub: "4\u20136 yrs" },
  { value: "MIDDLE", label: "Middle", sub: "7\u20139 yrs" },
  { value: "TWEEN", label: "Tween", sub: "10\u201312 yrs" },
  { value: "PRETEEN", label: "Preteen", sub: "12+ yrs" },
] as const

const LENGTHS = [
  { value: "quick", label: "Quick", sub: "~2\u20133 min" },
  { value: "short", label: "Short", sub: "~5 min" },
  { value: "medium", label: "Medium", sub: "~10 min" },
  { value: "long", label: "Long", sub: "~20 min" },
] as const

const ART_STYLE_PRESETS = [
  { value: "traditional watercolor on textured cold-press paper, visible brushstrokes, paint bleeds and soft edges, muted washed-out pigments, no digital effects", label: "Watercolor" },
  { value: "clean vector-style digital illustration, smooth gradients, rounded friendly shapes, vivid saturated colors, modern children's book like Oliver Jeffers", label: "Modern Storybook" },
  { value: "Japanese anime cel animation style, sharp clean outlines, flat color fills with dramatic shading, large glossy eyes, Studio Ghibli background detail", label: "Anime / Ghibli" },
  { value: "1950s golden age picture book, grainy lithograph texture, limited muted color palette of ochre rust sage and cream, visible halftone dots, retro typography feel", label: "Vintage / Retro" },
  { value: "photorealistic 3D render, subsurface skin scattering, ray-traced lighting, shallow depth of field, Pixar-quality character rendering", label: "Photorealistic 3D" },
  { value: "torn paper collage with visible paper textures and edges, layered cutout shapes, bold primary colors, tactile handmade craft aesthetic like Eric Carle", label: "Paper Collage" },
  { value: "loose pencil and charcoal sketch on cream paper, crosshatching for shadows, no color, visible eraser marks and construction lines, raw and expressive", label: "Pencil Sketch" },
  { value: "oil painting with thick impasto brushstrokes, rich deep colors, warm golden light, classical storybook feel like golden age fairy tale illustrations", label: "Oil Painting" },
  { value: "kawaii chibi style, extremely round simplified proportions, tiny body with oversized head, pastel candy colors, sparkle effects, cute Japanese aesthetic", label: "Chibi / Kawaii" },
  { value: "dark moody gouache, deep jewel tones on black background, dramatic chiaroscuro lighting, mysterious atmosphere, Brian Froud or Arthur Rackham inspired", label: "Dark Fantasy" },
] as const

const PIPELINE_STEPS: Record<string, { label: string; stage: string }> = {
  "normalize-request":       { label: "Understanding your story setup...", stage: "Understanding your story setup..." },
  "retrieve-context":        { label: "Loading character memories", stage: "Understanding your story setup..." },
  "generate-outline":        { label: "Planning your story...", stage: "Planning your story..." },
  "validate-repair-outline": { label: "Reviewing the plan", stage: "Planning your story..." },
  "generate-story-draft":    { label: "Writing your story...", stage: "Writing your story..." },
  "validate-repair-story":   { label: "Checking story quality", stage: "Writing your story..." },
  "extract-scene-specs":     { label: "Selecting key moments...", stage: "Selecting key moments..." },
  "validate-scenes":         { label: "Validating scenes", stage: "Selecting key moments..." },
  "enrich-image-prompts":    { label: "Preparing illustrations", stage: "Creating illustrations..." },
  "generate-images":         { label: "Creating illustrations...", stage: "Creating illustrations..." },
  "qa-images":               { label: "Checking image quality", stage: "Creating illustrations..." },
  "update-memory":           { label: "Saving progress", stage: "Finalizing your story..." },
  "persist-outputs":         { label: "Finalizing your story...", stage: "Finalizing your story..." },
}

interface StepUpdate {
  step: string
  status: "started" | "completed" | "failed" | "skipped"
  durationMs?: number
  provider?: string
}

interface CharacterOption { id: string; name: string; description: string | null }
interface WorldOption { id: string; name: string; description: string | null }
interface ArtStyleOption { id: string; name: string; styleKeywords: string[]; medium: string | null }
interface PromptSeedOption { id: string; name: string; prompt: string; themes: string[] }

interface StoryOption { id: string; title: string }

interface Props {
  seriesId: string
  branchId: string
  volumeId: string
  characters: CharacterOption[]
  worlds: WorldOption[]
  artStyles: ArtStyleOption[]
  promptSeeds: PromptSeedOption[]
  existingStories?: StoryOption[]
  initialParentStoryId?: string
  inheritedCharacterIds?: string[]
  parentHadImages?: boolean
  defaultArtStyle?: string
}

type InputMode = "auto" | "library" | "custom"

export function GenerateStoryForm({ seriesId, branchId, volumeId, characters, worlds, artStyles, promptSeeds, existingStories = [], initialParentStoryId, inheritedCharacterIds = [], parentHadImages = false, defaultArtStyle = "" }: Props) {
  const router = useRouter()

  // Story type
  const [storyType, setStoryType] = useState<"new" | "continuation">(initialParentStoryId ? "continuation" : "new")
  const [parentStoryId, setParentStoryId] = useState(initialParentStoryId ?? "")

  // Core selections
  const [storyMode, setStoryMode] = useState<string>("CALM_BEDTIME")
  const [ageBand, setAgeBand] = useState<string>("EARLY")
  const [length, setLength] = useState<string>("quick")
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>(
    inheritedCharacterIds.length > 0
      ? inheritedCharacterIds
      : characters.length === 1
        ? [characters[0].id]
        : []
  )
  const [lockedCharacterIds] = useState<Set<string>>(new Set(inheritedCharacterIds))
  const [storyTitle, setStoryTitle] = useState("")
  const [generateImages, setGenerateImages] = useState(parentHadImages)

  // Supporting characters
  const [supportingMode, setSupportingMode] = useState<string>("auto")
  const [supportingDescription, setSupportingDescription] = useState("")
  const [showSupportingDescription, setShowSupportingDescription] = useState(false)

  // Story idea — unified input
  const [storyIdeaMode, setStoryIdeaMode] = useState<InputMode>("auto")
  const [customPrompt, setCustomPrompt] = useState("")
  const [selectedPromptSeed, setSelectedPromptSeed] = useState("")

  // World — unified input (default to library if worlds are linked)
  const [worldInputMode, setWorldInputMode] = useState<InputMode>(worlds.length > 0 ? "library" : "auto")
  const [selectedWorld, setSelectedWorld] = useState(worlds.length === 1 ? worlds[0].id : "")
  const [customWorld, setCustomWorld] = useState("")

  // Art style — unified input
  const [artStyleInputMode, setArtStyleInputMode] = useState<InputMode>(defaultArtStyle ? "custom" : "auto")
  const [selectedArtStyle, setSelectedArtStyle] = useState("")
  const [customArtStyle, setCustomArtStyle] = useState(defaultArtStyle)

  // Generation state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [runId, setRunId] = useState<string | null>(null)
  const [steps, setSteps] = useState<StepUpdate[]>([])
  const [finalStatus, setFinalStatus] = useState<string | null>(null)
  const [storyId, setStoryId] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const toggleCharacter = (id: string) => {
    // Cannot remove inherited continuation characters
    if (lockedCharacterIds.has(id) && selectedCharacters.includes(id) && storyType === "continuation") return
    setSelectedCharacters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  // SSE stream for generation progress
  useEffect(() => {
    if (!runId) return
    const es = new EventSource(`/api/generate/${runId}/stream`)
    eventSourceRef.current = es
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "step") {
          setSteps((prev) => {
            const existing = prev.findIndex((s) => s.step === data.step && s.status === data.status)
            if (existing >= 0) return prev
            return [...prev, data as StepUpdate]
          })
        } else if (data.type === "done") {
          setFinalStatus(data.status)
          if (data.storyId) setStoryId(data.storyId)
          es.close()
        } else if (data.type === "error") {
          setFinalStatus("failed")
          setError(data.message ?? "Generation failed")
          es.close()
        }
      } catch { /* ignore */ }
    }
    es.onerror = () => es.close()
    return () => { es.close(); eventSourceRef.current = null }
  }, [runId])

  // Redirect when done
  useEffect(() => {
    if ((finalStatus === "completed" || finalStatus === "partial") && storyId) {
      const timer = setTimeout(() => router.push(`/series/${seriesId}/stories/${storyId}`), 1500)
      return () => clearTimeout(timer)
    }
  }, [finalStatus, storyId, seriesId, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    setSteps([])
    setFinalStatus(null)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,
          branchId,
          volumeId,
          storyTitle: storyTitle.trim() || undefined,
          storyType,
          parentStoryId: storyType === "continuation" && parentStoryId ? parentStoryId : undefined,
          mode: storyMode,
          ageBand,
          length,
          characterIds: selectedCharacters,
          // Supporting characters
          supportingCharacterMode: supportingMode,
          supportingCharacterDescription: supportingMode === "add_one" && showSupportingDescription && supportingDescription.trim()
            ? supportingDescription.trim() : undefined,
          // Story idea
          storyIdeaMode,
          prompt: storyIdeaMode === "custom" ? customPrompt : undefined,
          promptSeedId: storyIdeaMode === "library" && selectedPromptSeed ? selectedPromptSeed : undefined,
          // World
          worldMode: worldInputMode,
          worldId: worldInputMode === "library" && selectedWorld ? selectedWorld : undefined,
          customWorld: worldInputMode === "custom" ? customWorld : undefined,
          // Art style
          artStyleMode: artStyleInputMode,
          artStylePresetId: artStyleInputMode === "library" && selectedArtStyle ? selectedArtStyle : undefined,
          customArtStyle: artStyleInputMode === "custom" ? customArtStyle : undefined,
          generateImages,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message ?? data?.error ?? "Failed to start generation")
      }
      const data = await res.json()
      setRunId(data.runId)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  const isGenerating = runId !== null && finalStatus !== "failed"

  // Stall detection: warn if no new events for 60s
  const [stalled, setStalled] = useState(false)
  const lastEventRef = useRef(Date.now())

  useEffect(() => {
    if (!isGenerating) return
    lastEventRef.current = Date.now()
  }, [steps.length, isGenerating])

  useEffect(() => {
    if (!isGenerating || finalStatus) return
    const interval = setInterval(() => {
      if (Date.now() - lastEventRef.current > 60_000) setStalled(true)
      else setStalled(false)
    }, 5000)
    return () => clearInterval(interval)
  }, [isGenerating, finalStatus])

  function handleRetry() {
    setRunId(null)
    setSteps([])
    setFinalStatus(null)
    setError("")
    setSubmitting(false)
    setStalled(false)
  }

  // ── Generation Progress View ──
  if (isGenerating || finalStatus === "failed") {
    const completedCount = new Set(steps.filter((s) => s.status === "completed").map((s) => s.step)).size
    const totalSteps = generateImages ? 9 : 6
    // Minimum 3% so bar is never invisible; ramp smoothly
    const rawProgress = (completedCount / totalSteps) * 100
    const progress = Math.min(Math.max(rawProgress, steps.length > 0 ? 5 : 3), 100)
    const isDone = finalStatus === "completed" || finalStatus === "partial"
    const isFailed = finalStatus === "failed"
    const currentStep = [...steps].reverse().find((s) => s.status === "started" || s.status === "completed")
    const hasSteps = steps.length > 0

    // Primary status uses the high-level stage name, not individual step labels
    const currentStage = hasSteps
      ? (PIPELINE_STEPS[currentStep?.step ?? ""]?.stage ?? "Working\u2026")
      : "Understanding your story setup\u2026"

    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/5 rounded-full mb-8 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ease-out ${isDone ? "bg-green-500" : isFailed ? "bg-red-500" : "bg-indigo-500"}`}
            style={{ width: `${isDone ? 100 : progress}%` }} />
        </div>

        {/* Status message */}
        <div className="text-center mb-8">
          {isDone ? (
            <>
              <p className="text-green-400 text-lg font-medium mb-1">Story complete!</p>
              <p className="text-white/40 text-sm">Redirecting\u2026</p>
            </>
          ) : isFailed ? (
            <>
              <p className="text-red-400 text-lg font-medium mb-1">Generation failed</p>
              <p className="text-white/50 text-sm mb-4">{error || "Something went wrong. Please try again."}</p>
              <button onClick={handleRetry}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors">
                Try again
              </button>
            </>
          ) : stalled ? (
            <>
              <p className="text-amber-400 text-lg font-medium mb-1">Taking longer than expected</p>
              <p className="text-white/40 text-sm">Still working. This sometimes happens with complex stories.</p>
            </>
          ) : (
            <>
              <p className={`text-white text-lg font-medium mb-1 ${!hasSteps ? "animate-pulse" : ""}`}>{currentStage}</p>
              <p className="text-white/30 text-sm">
                {hasSteps ? `Step ${completedCount + 1} of ~${totalSteps}` : "This usually takes 30\u201390 seconds"}
              </p>
            </>
          )}
        </div>

        {/* Step list */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {steps.length === 0 && !isFailed && (
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-white/30 animate-pulse">
              <span className="w-5 text-center shrink-0">{"\u25CB"}</span>
              <span>Understanding your story setup\u2026</span>
            </div>
          )}
          {steps.map((s, i) => {
            const info = PIPELINE_STEPS[s.step]
            return (
              <div key={`${s.step}-${s.status}-${i}`} className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm ${s.status === "completed" ? "text-white/40" : s.status === "started" ? "text-white bg-white/5" : s.status === "failed" ? "text-red-400/70" : "text-white/20"}`}>
                <span className="w-5 text-center shrink-0">{s.status === "completed" ? "\u2713" : s.status === "started" ? "\u25CB" : s.status === "failed" ? "\u2717" : "\u2014"}</span>
                <span className={s.status === "started" ? "font-medium" : ""}>{info?.label ?? s.step}</span>
                {s.durationMs != null && s.status === "completed" && <span className="text-white/20 text-xs ml-auto">{(s.durationMs / 1000).toFixed(1)}s</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Story Composition Form ──
  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Story title ── */}
      <Section title="Story title" hint="optional">
        <input type="text" value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)}
          placeholder="Leave blank to let AI name the story"
          maxLength={200}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
      </Section>

      {/* ── Story type ── */}
      <Section title="Story type">
        <div className="grid grid-cols-2 gap-2">
          <ModeButton active={storyType === "new"} onClick={() => { setStoryType("new"); setParentStoryId("") }}
            label="New story" description="Standalone story in this series" />
          <ModeButton active={storyType === "continuation"}
            onClick={() => setStoryType("continuation")}
            label="Continue previous" description="Next chapter of an existing story" />
        </div>
        {storyType === "continuation" && (
          <div className="mt-3">
            {existingStories.length === 0 ? (
              <p className="text-xs text-white/40">No stories in this series yet. Create a new story first.</p>
            ) : (
              <CustomSelect value={parentStoryId} onChange={setParentStoryId}
                placeholder="Select the story to continue"
                options={existingStories.map((s) => ({ value: s.id, label: s.title }))} />
            )}
          </div>
        )}
      </Section>

      {/* ── Characters ── */}
      <Section title="Characters" hint={selectedCharacters.length > 0 ? `${selectedCharacters.length} selected` : undefined}>
        {characters.length === 0 ? (
          <EmptyHint text="No characters linked to this series." href={`/series/${seriesId}`} action="Link characters" />
        ) : (
          <>
            {selectedCharacters.length === 0 && (
              <p className="text-xs text-amber-400/80 mb-2">Select at least one character for your story</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {characters.map((c) => {
                const isLocked = storyType === "continuation" && lockedCharacterIds.has(c.id)
                const isSelected = selectedCharacters.includes(c.id)
                return (
                  <button key={c.id} type="button" onClick={() => toggleCharacter(c.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-500/15 text-white"
                        : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                    } ${isLocked ? "cursor-default opacity-80" : ""}`}
                    title={isLocked ? "Inherited from continued story" : undefined}>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-indigo-600 border-indigo-500" : "border-white/20"
                    }`}>
                      {isSelected && <span className="text-white text-xs">&#10003;</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.name}{isLocked ? " (inherited)" : ""}</p>
                      {c.description && <p className="text-xs text-white/30 leading-relaxed">{c.description}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </Section>

      {/* ── Supporting Characters ── */}
      <Section title="Supporting characters" hint={supportingMode}>
        <div className="grid grid-cols-3 gap-2">
          <ModeButton active={supportingMode === "none"} onClick={() => { setSupportingMode("none"); setShowSupportingDescription(false) }}
            label="None" description="Only your selected characters" />
          <ModeButton active={supportingMode === "auto"} onClick={() => { setSupportingMode("auto"); setShowSupportingDescription(false) }}
            label="Auto" description="AI adds if they improve the story" />
          <ModeButton active={supportingMode === "add_one"} onClick={() => setSupportingMode("add_one")}
            label="Add one" description="AI creates exactly one" />
        </div>
        {supportingMode === "add_one" && (
          <div className="mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showSupportingDescription} onChange={(e) => setShowSupportingDescription(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-0 focus:ring-offset-0" />
              <span className="text-xs text-white/50">Provide a quick description</span>
            </label>
            {showSupportingDescription && (
              <input type="text" value={supportingDescription} onChange={(e) => setSupportingDescription(e.target.value)}
                placeholder="e.g. a shy rabbit who lives next door"
                maxLength={300}
                className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
            )}
          </div>
        )}
      </Section>

      {/* ── Story Idea — Unified Input ── */}
      <Section title="Story idea">
        <InputModeTabs mode={storyIdeaMode} onChange={(m) => setStoryIdeaMode(m)} hasLibrary={promptSeeds.length > 0} />
        {storyIdeaMode === "auto" && (
          <p className="text-xs text-white/30 mt-2">AI will generate an engaging story premise based on your characters, world, and settings.</p>
        )}
        {storyIdeaMode === "library" && (
          <CustomSelect value={selectedPromptSeed} onChange={setSelectedPromptSeed}
            placeholder="Select a prompt seed" className="mt-2"
            options={promptSeeds.map((s) => ({ value: s.id, label: s.name }))} />
        )}
        {storyIdeaMode === "custom" && (
          <div className="mt-2">
            <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="What happens in this story? A sentence is enough, or go into as much detail as you'd like."
              rows={3} maxLength={2000}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
            <p className="text-xs text-white/30 mt-1">{customPrompt.length} / 2000</p>
          </div>
        )}
      </Section>

      {/* ── World — Unified Input ── */}
      <Section title="World">
        <InputModeTabs mode={worldInputMode} onChange={(m) => setWorldInputMode(m)} hasLibrary={worlds.length > 0} />
        {worldInputMode === "auto" && (
          <p className="text-xs text-white/30 mt-2">AI will create a coherent world setting that fits the story.</p>
        )}
        {worldInputMode === "library" && (
          <div className="grid grid-cols-1 gap-2 mt-2">
            {worlds.map((w) => (
              <button key={w.id} type="button" onClick={() => setSelectedWorld(selectedWorld === w.id ? "" : w.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                  selectedWorld === w.id
                    ? "border-indigo-500 bg-indigo-500/15 text-white"
                    : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}>
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                  selectedWorld === w.id ? "bg-indigo-600 border-indigo-500" : "border-white/20"
                }`}>
                  {selectedWorld === w.id && <span className="text-white text-xs">&#10003;</span>}
                </div>
                <div>
                  <p className="text-sm font-medium">{w.name}</p>
                  {w.description && <p className="text-xs text-white/30 leading-relaxed">{w.description}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
        {worldInputMode === "custom" && (
          <textarea value={customWorld} onChange={(e) => setCustomWorld(e.target.value)}
            placeholder="Describe the world briefly. e.g. A cozy underground village where mushrooms glow softly"
            rows={2} maxLength={500}
            className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
        )}
      </Section>

      {/* ── Art Style ── */}
      <Section title="Art style">
        <div className="flex flex-wrap gap-2">
          {ART_STYLE_PRESETS.map((preset) => (
            <button key={preset.value} type="button"
              onClick={() => {
                if (customArtStyle === preset.value) {
                  setCustomArtStyle("")
                  setArtStyleInputMode("auto")
                } else {
                  setCustomArtStyle(preset.value)
                  setArtStyleInputMode("custom")
                }
              }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                customArtStyle === preset.value
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"
              }`}>
              {preset.label}
            </button>
          ))}
        </div>
        <input type="text" value={customArtStyle} onChange={(e) => { setCustomArtStyle(e.target.value); setArtStyleInputMode(e.target.value ? "custom" : "auto") }}
          placeholder="Or describe your own style..."
          maxLength={500}
          className="mt-3 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
        {artStyleInputMode === "auto" && !customArtStyle && (
          <p className="text-xs text-white/30 mt-1.5">No style selected — AI will choose one that matches the tone.</p>
        )}
        {artStyles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-xs text-white/30 mb-2">From your library:</p>
            <div className="flex flex-wrap gap-2">
              {artStyles.map((s) => (
                <button key={s.id} type="button"
                  onClick={() => {
                    setSelectedArtStyle(s.id)
                    setArtStyleInputMode("library")
                    setCustomArtStyle("")
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    artStyleInputMode === "library" && selectedArtStyle === s.id
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"
                  }`}>
                  {s.name}{s.medium ? ` (${s.medium})` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Story Mode ── */}
      <Section title="Story mode">
        <div className="grid grid-cols-1 gap-2">
          {MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => setStoryMode(m.value)}
              className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors ${storyMode === m.value ? "border-indigo-500 bg-indigo-500/10 text-white" : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"}`}>
              <span className="font-medium">{m.label}</span>
              <span className="text-white/40 ml-2 text-xs">{m.description}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Age Band + Length row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Section title="Age band">
          <div className="flex flex-col gap-2">
            {AGE_BANDS.map((a) => (
              <button key={a.value} type="button" onClick={() => setAgeBand(a.value)}
                className={`px-4 py-2 rounded-lg border text-sm transition-colors text-left ${ageBand === a.value ? "border-indigo-500 bg-indigo-500/10 text-white" : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}>
                <span className="font-medium">{a.label}</span> <span className="text-white/40 text-xs">{a.sub}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Length">
          <div className="flex flex-col gap-2">
            {LENGTHS.map((l) => (
              <button key={l.value} type="button" onClick={() => setLength(l.value)}
                className={`px-4 py-2 rounded-lg border text-sm transition-colors text-left ${length === l.value ? "border-indigo-500 bg-indigo-500/10 text-white" : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}>
                <span className="font-medium">{l.label}</span> <span className="text-white/40 text-xs">{l.sub}</span>
              </button>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Images toggle ── */}
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white/80">Generate illustrations</p>
          <p className="text-xs text-white/40 mt-0.5">AI-generated scene images (adds ~30s)</p>
        </div>
        <button type="button" onClick={() => setGenerateImages((v) => !v)}
          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ml-4 ${generateImages ? "bg-indigo-500" : "bg-white/10"}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${generateImages ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

      <button type="submit" disabled={submitting}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
        {submitting ? "Starting\u2026" : "Generate story"}
      </button>
    </form>
  )
}

// ── Shared Components ──

function InputModeTabs({ mode, onChange, hasLibrary }: { mode: InputMode; onChange: (m: InputMode) => void; hasLibrary: boolean }) {
  return (
    <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
      <TabButton active={mode === "auto"} onClick={() => onChange("auto")} label="Auto" />
      {hasLibrary && <TabButton active={mode === "library"} onClick={() => onChange("library")} label="Library" />}
      <TabButton active={mode === "custom"} onClick={() => onChange("custom")} label="Write your own" />
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
      {label}
    </button>
  )
}

function ModeButton({ active, onClick, label, description }: { active: boolean; onClick: () => void; label: string; description: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${active ? "border-indigo-500 bg-indigo-500/10 text-white" : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"}`}>
      <span className="font-medium block">{label}</span>
      <span className="text-white/40 text-xs">{description}</span>
    </button>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <label className="text-sm font-medium text-white/80">{title}</label>
        {hint && <span className="text-xs text-white/30">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function EmptyHint({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div className="border border-dashed border-white/10 rounded-xl p-4 text-center">
      <p className="text-white/40 text-xs">{text}</p>
      <a href={href} className="text-indigo-400 hover:text-indigo-300 text-xs mt-1 inline-block">{action} &rarr;</a>
    </div>
  )
}
