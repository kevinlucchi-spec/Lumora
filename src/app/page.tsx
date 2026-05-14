// @ts-nocheck
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f0a1e] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌙</span>
          <span className="text-xl font-semibold tracking-tight">Lumora</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex flex-col items-center justify-center text-center px-6 pt-28 pb-20">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Where imagination becomes stories
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-tight max-w-3xl mb-6">
          A bedtime story{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
            universe
          </span>{" "}
          for your family
        </h1>

        <p className="text-lg text-white/50 max-w-xl mb-10 leading-relaxed">
          Generate beautiful, age-appropriate bedtime stories with recurring characters,
          branching timelines, and illustrations — powered by multiple AI models working together.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link
            href="/register"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-xl font-medium transition-colors"
          >
            Start your story universe
          </Link>
          <Link
            href="/discover"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-3.5 rounded-xl font-medium transition-colors"
          >
            Browse shared stories
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl w-full text-left">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* AI pipeline section */}
      <section className="border-t border-white/10 px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-3">How it works</h2>
          <p className="text-white/50 text-sm mb-10 max-w-lg mx-auto">
            Multiple AI models collaborate to write, illustrate, and validate every story.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {AI_ROLES.map((r) => (
              <div
                key={r.label}
                className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm"
              >
                <span className="text-base">{r.icon}</span>
                <span className="text-white/70">{r.label}</span>
                <span className="text-white/30">·</span>
                <span className="text-white/40 text-xs">{r.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-8 py-6 text-center text-xs text-white/30">
        Lumora — bedtime stories, brought to life
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: "📖",
    title: "Story universes",
    description:
      "Organize stories into series, branches, and volumes. Fork timelines into what-if adventures.",
  },
  {
    icon: "🧑‍🤝‍🧑",
    title: "Recurring characters",
    description:
      "Characters remember their past. Their personality, growth, and state carry across every story.",
  },
  {
    icon: "🎨",
    title: "Illustrations",
    description:
      "Scene specs drive image generation — consistent style, characters, and mood across every page.",
  },
  {
    icon: "✅",
    title: "Validated & safe",
    description:
      "Every story is checked for age-appropriateness, bedtime tone, and continuity before delivery.",
  },
  {
    icon: "🔒",
    title: "Private by default",
    description:
      "Your family's stories stay yours. Share only what you choose — templates, characters, or whole stories.",
  },
  {
    icon: "🔍",
    title: "Full auditability",
    description:
      "Every generation run is logged — prompts, models, validation reports, and token usage.",
  },
];

const AI_ROLES = [
  { icon: "✦", label: "Claude", role: "Story writer" },
  { icon: "◆", label: "GPT-4o", role: "Validator" },
  { icon: "◈", label: "Gemini", role: "Scene director" },
  { icon: "◇", label: "Grok", role: "Critic & variants" },
  { icon: "🖼", label: "DALL·E", role: "Illustrator" },
];
