import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import OpenAI from "openai"

const VOICES: Record<string, string> = {
  "alloy": "alloy",       // neutral, warm
  "nova": "nova",         // female, gentle
  "shimmer": "shimmer",   // female, soft
  "echo": "echo",         // male, warm
  "onyx": "onyx",         // male, deep
  "fable": "fable",       // expressive, storyteller
}

/**
 * POST: Generate TTS audio for a story.
 * Body: { voice?: string, pageIndex?: number }
 * If pageIndex is provided, reads just that page. Otherwise reads the full story.
 * Returns audio/mpeg stream.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; storyId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const { seriesId, storyId } = await params
  const body = await req.json()
  const voice = VOICES[body.voice ?? "nova"] ?? "nova"
  const pageIndex = body.pageIndex as number | undefined

  const story = await prisma.story.findFirst({
    where: { id: storyId, volume: { branch: { seriesId } } },
    select: { content: true, volume: { select: { branch: { select: { series: { select: { userId: true } } } } } } },
  })

  if (!story || story.volume.branch.series.userId !== session.user.id) {
    return new Response("Not found", { status: 404 })
  }

  const pages = story.content as Array<{ text: string }>
  let text: string

  if (pageIndex !== undefined && pageIndex >= 0 && pageIndex < pages.length) {
    text = pages[pageIndex].text
  } else {
    text = pages.map((p: { text: string }) => p.text).join("\n\n")
  }

  // Trim to OpenAI TTS limit (4096 chars per request)
  if (text.length > 4096) {
    text = text.slice(0, 4096)
  }

  // Add storytelling cues so TTS reads with more expression
  text = addStorytellingCues(text)

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const mp3 = await client.audio.speech.create({
      model: "tts-1",
      voice: voice as "alloy" | "nova" | "shimmer" | "echo" | "onyx" | "fable",
      input: text,
      speed: 1.0,
      response_format: "mp3",
    })

    // Stream the response so audio starts playing faster
    const buffer = Buffer.from(await mp3.arrayBuffer())

    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (err) {
    console.error("[tts] Failed:", (err as Error).message)
    return NextResponse.json({ error: "TTS generation failed" }, { status: 500 })
  }
}

/**
 * Wrap text with narration cues that nudge OpenAI TTS toward expressive reading.
 * tts-1-hd responds to context framing and punctuation styling.
 */
function addStorytellingCues(text: string): string {
  return text
    // Add a beat before dialogue
    .replace(/([.!?])\s*"/g, "$1 ... \"")
    // Em-dash pauses
    .replace(/ — /g, " —— ")
    // Soft trailing ending
    .replace(/\.\s*$/, ". ...")
}
