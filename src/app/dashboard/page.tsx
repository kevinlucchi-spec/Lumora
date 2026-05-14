// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { WinstonOnboarding } from "./winston-onboarding"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const series = await prisma.series.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      branches: {
        where: { isCanon: true },
        take: 1,
        include: {
          volumes: {
            take: 1,
            orderBy: { order: "desc" },
            include: {
              stories: {
                where: { archivedAt: null },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  })

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-5xl">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-1">
            Good evening, {session.user?.name ?? "Storyteller"}
          </h1>
          <p className="text-white/50">Your story universe awaits.</p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <Link href="/series/new"
            className="bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 rounded-2xl p-6 transition-colors">
            <h3 className="font-semibold mb-1">New series</h3>
            <p className="text-sm text-white/50">Start a new story universe</p>
          </Link>
          <Link href="/library/characters/new"
            className="bg-white/5 border border-white/10 hover:bg-white/[0.07] rounded-2xl p-6 transition-colors">
            <h3 className="font-semibold mb-1">New character</h3>
            <p className="text-sm text-white/50">Create a reusable character template</p>
          </Link>
          <Link href="/discover"
            className="bg-white/5 border border-white/10 hover:bg-white/[0.07] rounded-2xl p-6 transition-colors">
            <h3 className="font-semibold mb-1">Discover</h3>
            <p className="text-sm text-white/50">Browse shared templates & stories</p>
          </Link>
        </div>

        {/* Series list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your series</h2>
            <Link href="/series/new" className="text-sm text-indigo-400 hover:text-indigo-300">
              + New series
            </Link>
          </div>

          {series.length === 0 ? (
            <WinstonOnboarding userName={session.user?.name ?? "there"} userId={session.user.id} />
          ) : (
            <div className="space-y-3">
              {series.map((s) => {
                const storyCount = s.branches.reduce(
                  (acc, b) => acc + b.volumes.reduce((a, v) => a + v.stories.length, 0), 0
                )
                return (
                  <Link key={s.id} href={`/series/${s.id}`}
                    className="flex items-center justify-between bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-5 py-4 transition-colors group">
                    <div>
                      <p className="font-medium text-white/90 group-hover:text-white transition-colors">{s.name}</p>
                      {s.description && <p className="text-xs text-white/40 mt-0.5">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/30">
                      <span>{storyCount} {storyCount === 1 ? "story" : "stories"}</span>
                      <span>&rarr;</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
