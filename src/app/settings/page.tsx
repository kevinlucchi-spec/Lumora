// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { ChangePassword } from "./change-password"
import { EditProfile } from "./edit-profile"

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Settings</h1>
          <p className="text-white/50 text-sm">Account and application settings</p>
        </div>

        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-sm font-semibold mb-4 text-white/70 uppercase tracking-wider">Profile</h2>
            <EditProfile
              initialName={session.user?.name ?? ""}
              initialEmail={session.user?.email ?? ""}
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-sm font-semibold mb-4 text-white/70 uppercase tracking-wider">Change Password</h2>
            <ChangePassword />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
