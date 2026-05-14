// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { CopyToLibrary } from "./copy-to-library"

export default async function SharedCharacterPage({
  params,
}: {
  params: Promise<{ characterId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { characterId } = await params

  const character = await prisma.characterTemplate.findFirst({
    where: {
      id: characterId,
      sharePolicy: { in: ["PUBLIC_VIEW", "PUBLIC_REUSE"] },
    },
  })

  if (!character) notFound()

  const essence = character.essence as { personality?: string; appearance?: string; voiceTone?: string; age?: string }
  const isOwner = character.userId === session.user.id
  const canCopy = character.sharePolicy === "PUBLIC_REUSE" && !isOwner

  // Check if user already has a copy
  const alreadyCopied = !isOwner && await prisma.characterTemplate.findFirst({
    where: { userId: session.user.id, provenanceId: { not: null } },
    include: { provenance: true },
  }).then(c => c?.provenance?.originalAssetId === characterId).catch(() => false)

  let portraitUrl = null
  if (character.portraitAssetId) {
    const portrait = await prisma.imageAsset.findUnique({
      where: { id: character.portraitAssetId },
      select: { url: true },
    })
    if (portrait) {
      portraitUrl = portrait.url.startsWith("http") || portrait.url.startsWith("data:")
        ? portrait.url
        : `/api/images/${portrait.url}`
    }
  }

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-3xl">
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link href="/discover" className="hover:text-white transition-colors">Discover</Link>
          <span>/</span>
          <span className="text-white/70">{character.name}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6 items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">{character.name}</h1>
            {character.description && <p className="text-white/50 text-sm mb-4">{character.description}</p>}
            {isOwner && <p className="text-indigo-400 text-xs mb-4">(This is your character)</p>}

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              {essence.age && <div><p className="text-xs text-white/40 mb-1">Age</p><p className="text-sm text-white/80">{essence.age}</p></div>}
              {essence.personality && <div><p className="text-xs text-white/40 mb-1">Personality</p><p className="text-sm text-white/80">{essence.personality}</p></div>}
              {essence.appearance && <div><p className="text-xs text-white/40 mb-1">Appearance</p><p className="text-sm text-white/80">{essence.appearance}</p></div>}
              {essence.voiceTone && <div><p className="text-xs text-white/40 mb-1">Voice</p><p className="text-sm text-white/80">{essence.voiceTone}</p></div>}
            </div>

            {canCopy && !alreadyCopied && (
              <CopyToLibrary characterId={characterId} characterName={character.name} />
            )}
            {alreadyCopied && (
              <p className="text-green-400/60 text-xs mt-4">Already in your library</p>
            )}
          </div>

          {portraitUrl && (
            <div className="w-[240px] shrink-0">
              <img src={portraitUrl} alt={character.name} className="w-full rounded-xl border border-white/10" />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
