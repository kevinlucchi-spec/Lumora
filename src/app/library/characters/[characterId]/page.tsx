// @ts-nocheck
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { CharacterPortraitPanel } from "./portrait-panel"
import { EditableEssence } from "./editable-essence"

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ characterId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { characterId } = await params

  const character = await prisma.characterTemplate.findFirst({
    where: { id: characterId, userId: session.user.id, archivedAt: null },
    include: {
      instances: {
        include: { series: { select: { id: true, name: true } } },
      },
    },
  }).catch(() => null)

  if (!character) notFound()

  const essence = character.essence as {
    personality?: string
    appearance?: string
    voiceTone?: string
    age?: string
  }

  let portraitUrl: string | null = null
  let portraitName: string | null = null
  if (character.portraitAssetId) {
    const portrait = await prisma.imageAsset.findUnique({
      where: { id: character.portraitAssetId },
      select: { url: true, name: true },
    })
    if (portrait) {
      portraitUrl = portrait.url.startsWith("http") || portrait.url.startsWith("data:")
        ? portrait.url
        : `/api/images/${portrait.url}`
      portraitName = portrait.name
    }
  }

  return (
    <AppShell userName={session.user?.name ?? session.user?.email}>
      <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-4xl">
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link href="/library/characters" className="hover:text-white transition-colors">Characters</Link>
          <span>/</span>
          <span className="text-white/70">{character.name}</span>
        </div>

        {/* Essence + Portrait side by side */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6 mb-6 items-start">
          {/* Editable essence */}
          <EditableEssence
            characterId={characterId}
            initialName={character.name}
            initialDescription={character.description}
            initialEssence={essence}
            initialTags={Array.isArray(character.tags) ? character.tags as string[] : []}
          />

          {/* Portrait card */}
          <CharacterPortraitPanel
            characterId={characterId}
            initialPortraitUrl={portraitUrl}
            initialPortraitName={portraitName}
            hasAppearance={!!essence.appearance}
          />
        </div>

        {/* Series using this character */}
        {character.instances.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Used in</h2>
            <div className="space-y-2">
              {character.instances.map((inst) => (
                <Link key={inst.id} href={`/series/${inst.series.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                  <span className="text-sm text-white/70">{inst.series.name}</span>
                  <span className="text-white/30 text-xs">&rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
