// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { z } from "zod"
import { checkDependencies, hardDelete } from "@/lib/services/dependency-check"

const HardDeleteSchema = z.object({
  entityType: z.enum([
    "series", "branch", "volume", "story",
    "characterTemplate", "worldTemplate", "artStylePreset", "storyPromptSeed",
  ]),
  entityId: z.string().min(1),
  force: z.boolean().default(false),
})

/**
 * POST /api/admin/hard-delete
 * Check dependencies and optionally hard-delete an entity.
 * Without force=true, returns dependency report only.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = HardDeleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { entityType, entityId, force } = parsed.data

  // If not forcing, just return the dependency report
  if (!force) {
    const report = await checkDependencies(entityType, entityId)
    return NextResponse.json(report)
  }

  // Force delete
  const result = await hardDelete(entityType, entityId, session.user.id, true)

  if (!result.deleted) {
    return NextResponse.json(
      { error: result.reason, dependencies: result.dependencies },
      { status: 409 }
    )
  }

  return NextResponse.json({ deleted: true })
}
