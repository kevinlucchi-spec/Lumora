"use client"
// @ts-nocheck

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Asset { id: string; name: string; description?: string | null; medium?: string | null; prompt?: string | null }
interface StoryItem { id: string; title: string; order: number; storyType: string; parentStoryId: string | null }
interface Branch { id: string; name: string; isCanon: boolean; volumes: { stories: StoryItem[] }[] }

interface Props {
  seriesId: string
  branches: Branch[]
  linked: { characters: Asset[]; worlds: Asset[]; artStyles: Asset[]; promptSeeds: Asset[] }
  global: { characters: Asset[]; worlds: Asset[]; artStyles: Asset[]; promptSeeds: Asset[] }
}

type Tab = "branches" | "characters" | "worlds" | "artStyles"

const TABS: { key: Tab; label: string }[] = [
  { key: "branches", label: "Branches" },
  { key: "characters", label: "Characters" },
  { key: "worlds", label: "Worlds" },
  { key: "artStyles", label: "Art Styles" },
]

const ASSET_CONFIG: Record<string, { emoji: string; apiPath: string; idField: string; createHref: string; createLabel: string }> = {
  characters:  { emoji: "🧙", apiPath: "characters", idField: "characterTemplateId", createHref: "/library/characters/new", createLabel: "character" },
  worlds:      { emoji: "🌍", apiPath: "worlds", idField: "worldTemplateId", createHref: "/library/worlds", createLabel: "world" },
  artStyles:   { emoji: "🎨", apiPath: "art-styles", idField: "artStylePresetId", createHref: "/library/art-styles", createLabel: "art style" },
}

export function SeriesAssetTabs({ seriesId, branches, linked, global }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>("branches")
  const [showPicker, setShowPicker] = useState(false)
  const [linkedIds, setLinkedIds] = useState<Record<string, Set<string>>>({
    characters: new Set(linked.characters.map((a) => a.id)),
    worlds: new Set(linked.worlds.map((a) => a.id)),
    artStyles: new Set(linked.artStyles.map((a) => a.id)),
    promptSeeds: new Set((linked as Record<string, Asset[]>).promptSeeds?.map((a) => a.id) ?? []),
  })
  const [busy, setBusy] = useState<string | null>(null)

  async function linkAsset(tab: string, assetId: string) {
    const cfg = ASSET_CONFIG[tab]
    setBusy(assetId)
    try {
      const res = await fetch(`/api/series/${seriesId}/${cfg.apiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [cfg.idField]: assetId }),
      })
      if (res.ok) {
        setLinkedIds((prev) => ({ ...prev, [tab]: new Set([...prev[tab], assetId]) }))
        router.refresh()
      }
    } catch { /* ignore */ }
    setBusy(null)
  }

  async function unlinkAsset(tab: string, assetId: string) {
    const cfg = ASSET_CONFIG[tab]
    setBusy(assetId)
    try {
      await fetch(`/api/series/${seriesId}/${cfg.apiPath}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [cfg.idField]: assetId }),
      })
      setLinkedIds((prev) => {
        const next = new Set(prev[tab])
        next.delete(assetId)
        return { ...prev, [tab]: next }
      })
      router.refresh()
    } catch { /* ignore */ }
    setBusy(null)
  }

  function renderAssetTab(tab: string) {
    const cfg = ASSET_CONFIG[tab]
    const linkedList = (linked[tab as keyof typeof linked] ?? []) as Asset[]
    const globalList = (global[tab as keyof typeof global] ?? []) as Asset[]
    const currentLinked = linkedIds[tab] ?? new Set()
    const available = globalList.filter((a) => !currentLinked.has(a.id))

    return (
      <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold">{TABS.find((t) => t.key === tab)?.label}</h2>
          <div className="flex gap-2">
            {available.length > 0 && (
              <button onClick={() => setShowPicker(!showPicker)}
                className="text-xs sm:text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors">
                {showPicker ? "Done" : "+ Link"}
              </button>
            )}
            <Link href={cfg.createHref}
              className="text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors">
              + Create
            </Link>
          </div>
        </div>

        {/* Picker panel */}
        {showPicker && available.length > 0 && (
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 mb-6">
            <p className="text-xs text-indigo-300/70 mb-3">Select from your library to add to this series:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((a) => (
                <button key={a.id} onClick={() => linkAsset(tab, a.id)} disabled={busy === a.id}
                  className="flex items-center gap-3 bg-white/5 border border-white/10 hover:border-indigo-500/50 rounded-lg px-4 py-3 text-left transition-colors disabled:opacity-50 group">
                  <span className="text-base">{cfg.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 group-hover:text-white truncate">{a.name}</p>
                    {a.description && <p className="text-xs text-white/30 truncate">{a.description}</p>}
                  </div>
                  <span className="text-xs text-indigo-400 shrink-0">{busy === a.id ? "..." : "Add"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Linked items */}
        {linkedList.filter((a) => currentLinked.has(a.id)).length === 0 && !showPicker ? (
          <div className="border border-dashed border-white/10 rounded-xl p-8 text-center">
            <span className="text-2xl">{cfg.emoji}</span>
            <p className="text-white/40 text-sm mt-2">No {cfg.createLabel}s linked to this series yet.</p>
            <p className="text-white/30 text-xs mt-1 mb-4">Link existing assets from your library or create new ones.</p>
            <div className="flex justify-center gap-3">
              {available.length > 0 && (
                <button onClick={() => setShowPicker(true)} className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-4 py-2 rounded-lg transition-colors">
                  Browse library
                </button>
              )}
              <Link href={cfg.createHref} className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors">
                Create {cfg.createLabel}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {linkedList.filter((a) => currentLinked.has(a.id)).map((a) => {
              const detailHref = tab === "characters" ? `/library/characters/${a.id}` :
                tab === "worlds" ? `/library/worlds` :
                tab === "artStyles" ? `/library/art-styles` :
                tab === "promptSeeds" ? `/library/prompt-seeds` : undefined

              return (
                <div key={a.id} className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 group transition-colors min-w-0 overflow-hidden">
                  {detailHref ? (
                    <Link href={detailHref} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <span className="text-base">{cfg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/70 group-hover:text-white truncate">{a.name}</p>
                        {a.description && <p className="text-xs text-white/30 truncate">{a.description}</p>}
                      </div>
                    </Link>
                  ) : (
                    <>
                      <span className="text-base">{cfg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/70 truncate">{a.name}</p>
                        {a.description && <p className="text-xs text-white/30 truncate">{a.description}</p>}
                      </div>
                    </>
                  )}
                  <button onClick={(e) => { e.preventDefault(); unlinkAsset(tab, a.id) }} disabled={busy === a.id}
                    className="text-xs text-white/20 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100" title="Remove from series">
                    {busy === a.id ? "..." : "Remove"}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="flex gap-1 border-b border-white/10 mb-8 overflow-x-auto">
        {TABS.map((tab) => {
          const count = tab.key !== "branches"
            ? (linkedIds[tab.key]?.size ?? 0)
            : branches.reduce((acc, b) => acc + b.volumes.reduce((a, v) => a + v.stories.length, 0), 0)
          return (
            <button key={tab.key}
              onClick={() => { setActiveTab(tab.key); setShowPicker(false) }}
              className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === tab.key ? "border-indigo-500 text-white" : "border-transparent text-white/40 hover:text-white/70"}`}>
              {tab.label} {count > 0 && <span className="text-white/30 ml-1">{count}</span>}
            </button>
          )
        })}
      </div>

      {activeTab === "branches" && (
        <div className="space-y-3">
          {branches.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/40 text-sm">No branches yet.</p>
            </div>
          ) : branches.map((branch) => {
            const storyCount = branch.volumes.reduce((acc, v) => acc + v.stories.length, 0)
            return (
              <div key={branch.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${branch.isCanon ? "bg-indigo-400" : "bg-white/30"}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm">{branch.name}</span>
                      {branch.isCanon && <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">canon</span>}
                    </div>
                    <p className="text-xs text-white/40">{storyCount} {storyCount === 1 ? "story" : "stories"} &middot; {branch.volumes.length} {branch.volumes.length === 1 ? "volume" : "volumes"}</p>
                  </div>
                </div>
                {storyCount > 0 && (() => {
                  const allStories = branch.volumes.flatMap((v) => v.stories)
                  // Group: standalone stories + continuation chains
                  const standalones = allStories.filter((s) => s.storyType !== "CONTINUATION" && !allStories.some((c) => c.parentStoryId === s.id))
                  const chainStarters = allStories.filter((s) => s.storyType !== "CONTINUATION" && allStories.some((c) => c.parentStoryId === s.id))

                  // Build chains from starters
                  const chains: StoryItem[][] = chainStarters.map((starter) => {
                    const chain = [starter]
                    let current = starter
                    while (true) {
                      const next = allStories.find((s) => s.parentStoryId === current.id)
                      if (!next) break
                      chain.push(next)
                      current = next
                    }
                    return chain
                  })

                  // Orphan continuations (parent deleted/missing)
                  const accounted = new Set([...standalones.map((s) => s.id), ...chains.flat().map((s) => s.id)])
                  const orphans = allStories.filter((s) => !accounted.has(s.id))

                  return (
                    <div className="mt-4 ml-2 sm:ml-6 space-y-3">
                      {/* Continuation chains */}
                      {chains.map((chain) => (
                        <div key={chain[0].id} className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-2">
                          <p className="text-[10px] text-indigo-300/50 uppercase tracking-wider px-2 mb-1">Story arc &middot; {chain.length} parts</p>
                          <div className="space-y-0.5">
                            {chain.map((s, i) => (
                              <Link key={s.id} href={`/series/${seriesId}/stories/${s.id}`}
                                className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors group">
                                <span className="text-indigo-400/50 text-xs">Part {i + 1}</span>
                                <span className="text-sm text-white/70 group-hover:text-white transition-colors flex-1 truncate">{s.title}</span>
                                <span className="text-white/20 group-hover:text-white/50 text-xs">Read &rarr;</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* Standalone stories */}
                      {[...standalones, ...orphans].map((s) => (
                        <Link key={s.id} href={`/series/${seriesId}/stories/${s.id}`}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group">
                          <span className="text-white/20 text-xs">#{s.order}</span>
                          <span className="text-sm text-white/70 group-hover:text-white transition-colors flex-1 truncate">{s.title}</span>
                          <span className="text-white/20 group-hover:text-white/50 text-xs">Read &rarr;</span>
                        </Link>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}

      {activeTab !== "branches" && renderAssetTab(activeTab)}
    </>
  )
}
