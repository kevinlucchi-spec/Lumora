// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-yellow-500/20 text-yellow-300",
  RUNNING:   "bg-blue-500/20 text-blue-300",
  COMPLETED: "bg-green-500/20 text-green-300",
  PARTIAL:   "bg-orange-500/20 text-orange-300",
  FAILED:    "bg-red-500/20 text-red-300",
}

export default async function RunsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  let runs: {
    id: string
    status: string
    createdAt: Date
    completedAt: Date | null
    latencyMs: number | null
    story: { id: string; title: string } | null
  }[] = []

  try {
    runs = await prisma.generationRun.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        latencyMs: true,
        story: { select: { id: true, title: true } },
      },
    })
  } catch {
    // DB not connected
  }

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Generation runs</h1>
          <p className="text-white/50 text-sm">
            Inspect every AI pipeline execution — prompts, models, validation reports, and token usage.
          </p>
        </div>

        {runs.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center">
            <div className="text-4xl mb-3">⚙</div>
            <p className="text-white/50 text-sm">
              No generation runs yet. Create a series and generate your first story.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-5 py-4 flex items-center gap-4 transition-colors group"
              >
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_COLOR[run.status] ?? "bg-white/10 text-white/50"}`}>
                  {run.status}
                </span>
                <span className="flex-1 text-sm text-white/70 group-hover:text-white transition-colors truncate">
                  {run.story?.title ?? "Unnamed run"}
                </span>
                <span className="text-xs text-white/30 shrink-0">
                  {new Date(run.createdAt).toLocaleString()}
                </span>
                {run.latencyMs && (
                  <span className="text-xs text-white/20 shrink-0">
                    {(run.latencyMs / 1000).toFixed(1)}s
                  </span>
                )}
                <span className="text-white/20 group-hover:text-white/50 transition-colors text-sm">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
