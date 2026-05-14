import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
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

export default async function RunInspectorPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { runId } = await params

  const run = await prisma.generationRun.findFirst({
    where: { id: runId, userId: session.user.id },
    include: { story: { select: { id: true, title: true, volume: { include: { branch: { select: { seriesId: true } } } } } } },
  }).catch(() => null)

  if (!run) notFound()

  const providerLog = run.providerLog as { step: string; model?: string; provider?: string; tokens?: number; durationMs?: number }[]
  const validationReports = run.validationReports as { step: string; passed: boolean; issues?: string[] }[]
  const errors = run.errors as { step: string; critical: boolean; message: string }[]
  const tokenUsage = run.tokenUsage as { promptTokens?: number; completionTokens?: number; total?: number } | null
  const requestPayload = run.requestPayload as Record<string, unknown>

  const seriesId = run.story?.volume?.branch?.seriesId

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-8 py-10 max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link href="/runs" className="hover:text-white transition-colors">Runs</Link>
          <span>/</span>
          <span className="font-mono text-white/60 text-xs">{run.id}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold">
                {run.story?.title ?? "Generation run"}
              </h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[run.status] ?? "bg-white/10 text-white/50"}`}>
                {run.status}
              </span>
            </div>
            <p className="text-white/40 text-sm">
              Started {new Date(run.createdAt).toLocaleString()}
              {run.completedAt && ` · Completed ${new Date(run.completedAt).toLocaleString()}`}
              {run.latencyMs && ` · ${(run.latencyMs / 1000).toFixed(1)}s`}
            </p>
          </div>
          {run.story && seriesId && (
            <Link
              href={`/series/${seriesId}/stories/${run.story.id}`}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors shrink-0"
            >
              Read story →
            </Link>
          )}
        </div>

        <div className="space-y-6">
          {/* Token usage */}
          {tokenUsage && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Token usage</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{(tokenUsage.promptTokens ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1">Prompt tokens</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{(tokenUsage.completionTokens ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1">Completion tokens</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{(tokenUsage.total ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1">Total</p>
                </div>
              </div>
              {run.costEstimateUsd != null && (
                <p className="text-center text-xs text-white/30 mt-4">
                  Est. cost: ${run.costEstimateUsd.toFixed(4)}
                </p>
              )}
            </div>
          )}

          {/* Provider log */}
          {providerLog.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Pipeline steps</h2>
              <div className="space-y-2">
                {providerLog.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="text-sm text-white/70 flex-1 font-mono text-xs">{entry.step}</span>
                    {entry.provider && <span className="text-xs text-white/30">{entry.provider}</span>}
                    {entry.model && <span className="text-xs text-white/30 font-mono">{entry.model}</span>}
                    {entry.tokens != null && (
                      <span className="text-xs text-white/30">{entry.tokens.toLocaleString()} tok</span>
                    )}
                    {entry.durationMs != null && (
                      <span className="text-xs text-white/30">{entry.durationMs}ms</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation reports */}
          {validationReports.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Validation reports</h2>
              <div className="space-y-3">
                {validationReports.map((report, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`text-xs mt-0.5 ${report.passed ? "text-green-400" : "text-red-400"}`}>
                      {report.passed ? "✓" : "✗"}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-white/70 font-mono text-xs">{report.step}</p>
                      {report.issues && report.issues.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {report.issues.map((issue, j) => (
                            <li key={j} className="text-xs text-red-300/70">— {issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
              <h2 className="text-xs font-semibold text-red-400/70 uppercase tracking-wider mb-4">Errors</h2>
              <div className="space-y-2">
                {errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`text-xs mt-0.5 ${err.critical ? "text-red-400" : "text-orange-400"}`}>
                      {err.critical ? "CRITICAL" : "warn"}
                    </span>
                    <div>
                      <p className="text-xs text-white/40 font-mono">{err.step}</p>
                      <p className="text-sm text-red-300/80">{err.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request payload */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Request payload</h2>
            <pre className="text-xs text-white/50 font-mono overflow-auto max-h-64 leading-relaxed">
              {JSON.stringify(requestPayload, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
