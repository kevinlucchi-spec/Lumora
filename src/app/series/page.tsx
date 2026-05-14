import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { getSeriesForUser } from "@/lib/services/series.service"
import { DeleteButton } from "@/components/delete-button"
import Link from "next/link"

export default async function SeriesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  let seriesList: Awaited<ReturnType<typeof getSeriesForUser>> = []
  try {
    seriesList = await getSeriesForUser(session.user.id)
  } catch {
    // DB not connected yet — show empty state
  }

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-8 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Series</h1>
            <p className="text-white/50 text-sm">Your story universes</p>
          </div>
          <Link
            href="/series/new"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            + New series
          </Link>
        </div>

        {seriesList.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center">
            <div className="text-4xl mb-3">📚</div>
            <p className="text-white/50 text-sm mb-4">
              No series yet. Create your first story universe to get started.
            </p>
            <Link
              href="/series/new"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
            >
              Create a series
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {seriesList.map((s) => {
              const branchCount = s.branches.length
              return (
                <Link
                  key={s.id}
                  href={`/series/${s.id}`}
                  className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-5 flex items-center gap-4 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-lg shrink-0">
                    📖
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm mb-0.5 group-hover:text-indigo-300 transition-colors truncate">
                      {s.name}
                    </div>
                    {s.description && (
                      <p className="text-xs text-white/40 truncate">{s.description}</p>
                    )}
                    <p className="text-xs text-white/30 mt-0.5">
                      {branchCount} {branchCount === 1 ? "branch" : "branches"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DeleteButton
                      entityType="series"
                      entityId={s.id}
                      entityName={s.name}
                      archiveEndpoint={`/api/series/${s.id}`}
                    />
                    <span className="text-white/30 group-hover:text-white/60 transition-colors text-sm">→</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
