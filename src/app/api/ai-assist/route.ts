// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { z } from "zod"
import { generateAssetDraft, refineAssetDraft, type AssetType } from "@/lib/services/ai-assist"

const assetTypes = ["character", "world", "artStyle", "promptSeed"] as const
const valueType = z.union([z.string(), z.array(z.string())])

const GenerateSchema = z.object({
  action: z.literal("generate"),
  assetType: z.enum(assetTypes),
  userPrompt: z.string().min(3).max(1000),
  currentValues: z.record(z.string(), valueType).optional(),
})

const RefineSchema = z.object({
  action: z.literal("refine"),
  assetType: z.enum(assetTypes),
  currentValues: z.record(z.string(), valueType),
  refinementInstruction: z.string().min(3).max(500),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Determine action to pick the right schema
  const action = body?.action
  if (action !== "generate" && action !== "refine") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  try {
    let result: Record<string, unknown>

    if (action === "generate") {
      const parsed = GenerateSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
      result = await generateAssetDraft({
        assetType: parsed.data.assetType as AssetType,
        userPrompt: parsed.data.userPrompt,
        currentValues: parsed.data.currentValues as Record<string, string | string[]> | undefined,
      })
    } else {
      const parsed = RefineSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
      result = await refineAssetDraft({
        assetType: parsed.data.assetType as AssetType,
        currentValues: parsed.data.currentValues as Record<string, string | string[]>,
        refinementInstruction: parsed.data.refinementInstruction,
      })
    }

    return NextResponse.json({ fields: result })
  } catch (err) {
    console.error("[ai-assist] Error:", err)
    return NextResponse.json(
      { error: (err as Error).message || "AI generation failed. Please try again." },
      { status: 500 }
    )
  }
}
