// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { DeleteButton } from "@/components/delete-button"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { BulkActions } from "./bulk-actions"

const LIBRARY_TABS = [
  { label: "Characters", href: "/library/characters" },
  { label: "Worlds", href: "/library/worlds" },
  { label: "Art Styles", href: "/library/art-styles" },
  { label: "Prompt Seeds", href: "/library/prompt-seeds" },
]

export default async function CharactersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  let characters: { id: string; name: string; description: string | null; tags: unknown; updatedAt: Date }[] = []
  try {
    characters = await prisma.characterTemplate.findMany({
      where: { userId: session.user.id, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, description: true, tags: true, updatedAt: true },
    })
  } catch {
    // DB not connected
  }

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-8 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Characters</h1>
            <p className="text-white/50 text-sm">Reusable character templates — the essence of your recurring cast</p>
          </div>
          <Link
            href="/library/characters/new"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            + New character
          </Link>
        </div>

        <div className="flex gap-1 border-b border-white/10 mb-8">
          {LIBRARY_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
                tab.href === "/library/characters"
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Bulk actions */}
        <div className="mb-4 flex justify-end">
          <BulkActions characters={characters.map((c) => ({ id: c.id, name: c.name }))} />
        </div>

        {characters.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center">
            <div className="text-4xl mb-3">🧑‍🎨</div>
            <p className="text-white/50 text-sm mb-4">
              No characters yet. Create a character template to reuse them across multiple series.
            </p>
            <Link
              href="/library/characters/new"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
            >
              Create a character
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {characters.map((c) => (
              <Link
                key={c.id}
                href={`/library/characters/${c.id}`}
                className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-5 group transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center text-base shrink-0">
                    🧙
                  </div>
                  <div className="flex items-center gap-2">
                    <DeleteButton
                      entityType="characterTemplate"
                      entityId={c.id}
                      entityName={c.name}
                      archiveEndpoint={`/api/library/characters/${c.id}`}
                    />
                    <span className="text-white/30 group-hover:text-white/60 transition-colors text-sm mt-1">→</span>
                  </div>
                </div>
                <p className="font-medium text-sm mt-3 mb-1 group-hover:text-indigo-300 transition-colors">{c.name}</p>
                {c.description && <p className="text-xs text-white/40 line-clamp-2">{c.description}</p>}
                {Array.isArray(c.tags) && (c.tags as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(c.tags as string[]).slice(0, 4).map((t: string) => (
                      <span key={t} className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-white/40">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
