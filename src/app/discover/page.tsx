// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

export default async function DiscoverPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [publicStories, publicCharacters, publicWorlds] = await Promise.all([
    prisma.story.findMany({
      where: { sharePolicy: { in: ["PUBLIC_VIEW", "PUBLIC_REUSE"] }, archivedAt: null },
      include: {
        volume: { include: { branch: { include: { series: { select: { name: true } } } } } },
        imageAssets: { select: { url: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }).catch(() => []),
    prisma.characterTemplate.findMany({
      where: { sharePolicy: { in: ["PUBLIC_VIEW", "PUBLIC_REUSE"] }, archivedAt: null },
      select: { id: true, name: true, description: true, sharePolicy: true, portraitAssetId: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }).catch(() => []),
    prisma.worldTemplate.findMany({
      where: { sharePolicy: { in: ["PUBLIC_VIEW", "PUBLIC_REUSE"] }, archivedAt: null },
      select: { id: true, name: true, description: true, sharePolicy: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }).catch(() => []),
  ])

  // Get portrait URLs for characters
  const portraitIds = publicCharacters.filter(c => c.portraitAssetId).map(c => c.portraitAssetId)
  const portraits = portraitIds.length > 0
    ? await prisma.imageAsset.findMany({ where: { id: { in: portraitIds } }, select: { id: true, url: true } }).catch(() => [])
    : []
  const portraitMap = new Map(portraits.map(p => [p.id, p.url.startsWith("http") || p.url.startsWith("data:") ? p.url : `/api/images/${p.url}`]))

  const hasContent = publicStories.length > 0 || publicCharacters.length > 0 || publicWorlds.length > 0

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Discover</h1>
          <p className="text-white/50 text-sm">Public stories, characters, and worlds shared by the community</p>
        </div>

        {!hasContent ? (
          <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center">
            <p className="text-white/40 text-sm mb-2">Nothing shared yet.</p>
            <p className="text-white/30 text-xs">Share your characters, worlds, or stories from their detail pages to see them here.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Public Characters */}
            {publicCharacters.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Characters</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {publicCharacters.map((c) => (
                    <Link key={c.id} href={`/shared/character/${c.id}`}
                      className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-colors group">
                      <div className="flex items-start gap-3">
                        {c.portraitAssetId && portraitMap.has(c.portraitAssetId) ? (
                          <img src={portraitMap.get(c.portraitAssetId)} alt={c.name}
                            className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">🧙</div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white/80 group-hover:text-white">{c.name}</p>
                          {c.description && <p className="text-xs text-white/40 mt-0.5 break-words">{c.description}</p>}
                          {c.sharePolicy === "PUBLIC_REUSE" && (
                            <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-full mt-1 inline-block">Reusable</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Public Stories */}
            {publicStories.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Stories</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {publicStories.map((s) => {
                    const thumb = s.imageAssets[0]
                    const thumbUrl = thumb ? (thumb.url.startsWith("http") || thumb.url.startsWith("data:") ? thumb.url : `/api/images/${thumb.url}`) : null
                    return (
                      <Link key={s.id} href={`/shared/story/${s.id}`}
                        className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl overflow-hidden transition-colors group">
                        {thumbUrl && <img src={thumbUrl} alt="" className="w-full h-32 object-cover" />}
                        <div className="p-4">
                          <p className="text-sm font-medium text-white/80 group-hover:text-white">{s.title}</p>
                          <p className="text-xs text-white/40 mt-1">From {s.volume.branch.series.name}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Public Worlds */}
            {publicWorlds.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Worlds</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {publicWorlds.map((w) => (
                    <div key={w.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <p className="text-sm font-medium text-white/80">🌍 {w.name}</p>
                      {w.description && <p className="text-xs text-white/40 mt-1 break-words">{w.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
