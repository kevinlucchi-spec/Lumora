"use client"

import { useState, useRef, useEffect } from "react"

const VOICES = [
  { id: "shimmer", label: "Shimmer", description: "Female — gentle, soothing bedtime voice" },
  { id: "nova", label: "Nova", description: "Female — warm, expressive" },
  { id: "fable", label: "Fable", description: "Male — animated storyteller" },
  { id: "echo", label: "Echo", description: "Male — calm, friendly" },
  { id: "onyx", label: "Onyx", description: "Male — deep, rich" },
  { id: "alloy", label: "Alloy", description: "Neutral — balanced, clear" },
]

interface Props {
  seriesId: string
  storyId: string
  pageCount: number
}

export function ReadAloud({ seriesId, storyId, pageCount }: Props) {
  const [voice, setVoice] = useState("shimmer")
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(-1)
  const [showVoices, setShowVoices] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      abortRef.current?.abort()
    }
  }, [])

  function handlePause() {
    if (paused) {
      audioRef.current?.play()
      setPaused(false)
    } else {
      audioRef.current?.pause()
      setPaused(true)
    }
  }

  async function handlePlay() {
    if (playing && !paused) {
      handlePause()
      return
    }
    if (paused) {
      handlePause()
      return
    }

    stoppedRef.current = false
    setLoading(true)
    setPlaying(true)
    setCurrentPage(0)

    // Scroll to first page immediately
    document.querySelector(`[data-page-index="0"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })

    // Start fetching page 0 and page 1 in parallel for faster start
    let nextPagePromise: Promise<Blob | null> | null = null

    for (let i = 0; i < pageCount; i++) {
      if (stoppedRef.current) break

      setCurrentPage(i)

      const el = document.querySelector(`[data-page-index="${i}"]`)
      el?.scrollIntoView({ behavior: "smooth", block: "center" })

      try {
        // Use pre-fetched blob if available, otherwise fetch now
        let blob: Blob | null = null
        if (nextPagePromise && i > 0) {
          blob = await nextPagePromise
          nextPagePromise = null
        }
        if (!blob) {
          abortRef.current = new AbortController()
          const res = await fetch(`/api/series/${seriesId}/stories/${storyId}/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voice, pageIndex: i }),
            signal: abortRef.current.signal,
          })
          if (!res.ok) throw new Error("TTS failed")
          blob = await res.blob()
        }

        setLoading(false) // audio is ready, clear loading state

        // Pre-fetch next page while this one plays
        if (i + 1 < pageCount && !stoppedRef.current) {
          const nextController = new AbortController()
          nextPagePromise = fetch(`/api/series/${seriesId}/stories/${storyId}/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voice, pageIndex: i + 1 }),
            signal: nextController.signal,
          }).then((r) => r.ok ? r.blob() : null).catch(() => null)
        }

        const url = URL.createObjectURL(blob)
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => { URL.revokeObjectURL(url); resolve() }
          audio.onerror = () => { URL.revokeObjectURL(url); reject() }
          audio.play().catch(reject)
        })
      } catch {
        break
      }
    }

    setPlaying(false)
    setCurrentPage(-1)
    setLoading(false)
  }

  function handleStop() {
    stoppedRef.current = true
    abortRef.current?.abort()
    audioRef.current?.pause()
    setPlaying(false)
    setPaused(false)
    setCurrentPage(-1)
    setLoading(false)
  }

  const selectedVoice = VOICES.find((v) => v.id === voice)

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 mb-10">
      <div className="flex items-center gap-2">
        {/* Play / Pause button */}
        <button
          onClick={handlePlay}
          disabled={loading && !playing}
          className={`flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl transition-colors font-medium ${
            playing
              ? "bg-indigo-600 hover:bg-indigo-500 text-white"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          } disabled:opacity-50`}
        >
          {playing && loading ? (
            <>
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                <span className="block w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              </span>
              Preparing...
            </>
          ) : playing && paused ? (
            <>
              <span className="text-base leading-none">&#9654;</span>
              Resume {currentPage >= 0 ? `(${currentPage + 1}/${pageCount})` : ""}
            </>
          ) : playing ? (
            <>
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                <span className="flex gap-0.5">
                  <span className="block w-1 h-3 bg-white rounded-sm" />
                  <span className="block w-1 h-3 bg-white rounded-sm" />
                </span>
              </span>
              Pause {currentPage >= 0 ? `(${currentPage + 1}/${pageCount})` : ""}
            </>
          ) : (
            <>
              <span className="text-base leading-none">&#9654;</span>
              Read aloud
            </>
          )}
        </button>

        {/* Stop button — only visible when playing */}
        {playing && (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 text-white/50 hover:text-red-400 transition-colors font-medium"
          >
            <span className="w-3 h-3 flex items-center justify-center">
              <span className="block w-2.5 h-2.5 bg-current rounded-sm" />
            </span>
            Stop
          </button>
        )}

        {/* Voice selector */}
        <div className="relative">
          <button
            onClick={() => setShowVoices(!showVoices)}
            disabled={playing}
            className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white/80 px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
          >
            Voice: {selectedVoice?.label ?? voice}
          </button>

          {showVoices && !playing && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[220px]">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setVoice(v.id); setShowVoices(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    voice === v.id ? "bg-indigo-600/20 text-indigo-300" : "text-white/60 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  <span className="font-medium">{v.label}</span>
                  <span className="text-xs text-white/30 ml-2">{v.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {playing && currentPage >= 0 && (
          <span className="text-xs text-white/30 ml-auto">
            Reading page {currentPage + 1} of {pageCount}
          </span>
        )}
      </div>
    </div>
  )
}
