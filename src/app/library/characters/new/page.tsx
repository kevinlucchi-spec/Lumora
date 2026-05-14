import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { NewCharacterForm } from "./new-character-form"

export default async function NewCharacterPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-8 py-10 max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-white/40 mb-2">
            <a href="/library/characters" className="hover:text-white transition-colors">Characters</a>
            <span>/</span>
            <span className="text-white/70">New</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">New character</h1>
          <p className="text-white/50 text-sm">
            Define a character&apos;s core essence — personality, appearance, and voice. This template can be reused across any series.
          </p>
        </div>
        <NewCharacterForm />
      </div>
    </AppShell>
  )
}
