// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import Link from "next/link"

const SECTIONS = [
  {
    title: "Getting Started",
    icon: "🚀",
    steps: [
      "Register an account and log in",
      "Winston (the bookworm at the top of every page) will guide you through setup",
      "Pick an age band for your audience — this shapes everything",
      "Create your first character with a description, or let Winston surprise you",
      "Generate a portrait to establish their look",
      "Create a world for your stories to take place in",
      "Create a series to hold all the stories together",
    ],
  },
  {
    title: "Characters",
    icon: "🧙",
    steps: [
      "Characters live in your Library — reusable across multiple series",
      "Each character has an essence (personality, appearance, voice) and optionally a visual profile",
      "The more detail you add to appearance, the better AI-generated images will match",
      "Generate a portrait from the character detail page — pick an art style first",
      "The portrait becomes the reference image for all story illustrations featuring that character",
      "Characters can be linked to multiple series — they'll have separate memories in each",
    ],
  },
  {
    title: "Series & Stories",
    icon: "📚",
    steps: [
      "A Series is a story universe — all adventures for the same characters and world",
      "Each series has Branches (parallel timelines) and Volumes (story groups)",
      "Link characters, worlds, and art styles to a series before generating stories",
      "Stories can be New (standalone) or Continuations (sequels that remember everything)",
      "The AI remembers character development, plot events, and world state across stories",
      "Use 'Continue this story' at the bottom of any story to create a sequel",
    ],
  },
  {
    title: "Generating Stories",
    icon: "✨",
    steps: [
      "Go to a series and click 'Generate story'",
      "Pick your characters, story mode (Calm Bedtime, Cozy Adventure, etc.), and age band",
      "Choose an art style from the presets or write your own",
      "Toggle 'Generate images' for illustrated stories (takes longer but worth it)",
      "The AI writes the story, validates it, generates illustrations, and checks everything for consistency",
      "Supporting characters created in stories can be saved to your library for reuse",
    ],
  },
  {
    title: "Art Styles & Images",
    icon: "🎨",
    steps: [
      "Pick an art style when generating portraits or stories — Watercolor, Anime, Oil Painting, etc.",
      "The character portrait is used as a visual reference for all story scene images",
      "The AI checks every scene image against the portrait for character consistency",
      "If a scene drifts from the character design, it's automatically regenerated",
      "You can also upload your own images as character portraits",
    ],
  },
  {
    title: "Worlds",
    icon: "🌍",
    steps: [
      "Worlds define the setting, rules, and tone for your stories",
      "Link a world to a series and it becomes the backdrop for all stories in that series",
      "World rules are passed to the AI so stories stay consistent with the setting",
      "You can create worlds manually or let Winston build one for you",
    ],
  },
  {
    title: "Reading Stories",
    icon: "📖",
    steps: [
      "Open any story to read it with inline illustrations",
      "Use Read Aloud at the top — pick from 6 AI voices (Shimmer, Nova, Fable, etc.)",
      "Pause, resume, or stop at any time — the story scrolls as it reads",
      "Export as PDF from the bottom of the story page",
      "Continue the story with 'Continue this story' — the sequel remembers everything",
    ],
  },
  {
    title: "Winston (Your AI Assistant)",
    icon: "🐛",
    steps: [
      "Winston appears at the top of every page — click to chat",
      "He knows what's on every page and can guide you through any feature",
      "Ask him to create characters, series, worlds, generate stories, or delete things",
      "He can search your entire library — 'What was that story about the lost star?'",
      "Destructive actions (delete) always require confirmation",
      "His chat history persists as you navigate between pages",
    ],
  },
]

export default async function HelpPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-3xl">
        <div className="mb-10">
          <h1 className="text-2xl font-bold mb-2">How Lumora Works</h1>
          <p className="text-white/50 text-sm">A step-by-step guide to creating bedtime stories with AI</p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{section.icon}</span>
                <h2 className="text-lg font-semibold">{section.title}</h2>
              </div>
              <ol className="space-y-2">
                {section.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-indigo-400 font-medium shrink-0">{i + 1}.</span>
                    <span className="text-white/70">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-amber-900/10 border border-amber-700/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/winston.png" alt="Winston" className="w-10 h-10 rounded-full object-cover object-top border border-amber-600/40" />
            <div>
              <p className="text-sm font-medium text-amber-200">Still need help?</p>
              <p className="text-xs text-white/40">Winston is available on every page — just click the bar at the top</p>
            </div>
          </div>
          <Link href="/dashboard" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
