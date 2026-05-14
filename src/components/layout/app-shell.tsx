"use client"
// @ts-nocheck

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { WinstonAssistant } from "@/components/winston-assistant"

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: "⌂" },
  { label: "Series", href: "/series", icon: "📚" },
  { label: "Library", href: "/library/characters", icon: "🗂", children: [
    { label: "Characters", href: "/library/characters" },
    { label: "Worlds", href: "/library/worlds" },
    { label: "Art Styles", href: "/library/art-styles" },
  ]},
  { label: "Discover", href: "/discover", icon: "🔍" },
  { label: "Runs", href: "/runs", icon: "⚙" },
  { label: "Settings", href: "/settings", icon: "◈" },
]

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode
  userName?: string | null
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="min-h-screen bg-[#0f0a1e] text-white flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl">🌙</span>
          <span className="font-semibold tracking-tight">Lumora</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-white/60 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Backdrop (mobile only) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-56 bg-[#0f0a1e] border-r border-white/10 flex flex-col py-6 px-3
        transform transition-transform duration-200 ease-in-out
        md:static md:translate-x-0 md:shrink-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <Link href="/dashboard" className="flex items-center gap-2 px-3 mb-8">
          <span className="text-xl">🌙</span>
          <span className="font-semibold tracking-tight">Lumora</span>
        </Link>

        <nav className="flex flex-col gap-0.5 flex-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-indigo-600/20 text-indigo-300"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="text-base w-4 text-center">{item.icon}</span>
                  {item.label}
                </Link>
                {item.children && active && (
                  <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          pathname === child.href
                            ? "text-indigo-300"
                            : "text-white/40 hover:text-white/70"
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="px-3 pt-4 border-t border-white/10">
          <p className="text-xs text-white/40 mb-2 truncate">{userName}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-white/40 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-h-0">
        <WinstonAssistant />
        {children}
      </main>
    </div>
  )
}
