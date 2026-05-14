// @ts-nocheck
import Link from "next/link";

export default function DiscoverPage() {
  return (
    <div className="min-h-screen bg-[#0f0a1e] text-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🌙</span>
          <span className="text-xl font-semibold tracking-tight">Lumora</span>
        </Link>
        <Link href="/login" className="text-sm bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors">
          Sign in
        </Link>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Discover</h1>
        <p className="text-white/50 mb-10">Browse shared characters, worlds, and story seeds from the community.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-2/3 mb-3" />
              <div className="h-3 bg-white/5 rounded w-full mb-2" />
              <div className="h-3 bg-white/5 rounded w-4/5" />
            </div>
          ))}
        </div>
        <p className="text-center text-white/30 text-sm mt-12">
          Shared content coming soon — sign in to create and share your own.
        </p>
      </main>
    </div>
  );
}
