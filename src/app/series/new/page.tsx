// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { NewSeriesForm } from "./new-series-form"

export default async function NewSeriesPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-8 py-10 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">New series</h1>
          <p className="text-white/50 text-sm">Create a new story universe with its own characters, branches, and canon.</p>
        </div>
        <NewSeriesForm />
      </div>
    </AppShell>
  )
}
