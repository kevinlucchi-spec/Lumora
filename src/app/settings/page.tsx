import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { ChangePassword } from "./change-password"

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-8 py-10 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Settings</h1>
          <p className="text-white/50 text-sm">Account and application settings</p>
        </div>

        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-sm font-semibold mb-4 text-white/70 uppercase tracking-wider">Account</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Name</span>
                <span className="text-sm">{session.user?.name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Email</span>
                <span className="text-sm">{session.user?.email ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-sm font-semibold mb-4 text-white/70 uppercase tracking-wider">Change Password</h2>
            <ChangePassword />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-sm font-semibold mb-4 text-white/70 uppercase tracking-wider">API Keys</h2>
            <p className="text-sm text-white/40">Configure your AI provider keys in <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">.env.local</code></p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
