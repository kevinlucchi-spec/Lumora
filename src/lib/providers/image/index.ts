// @ts-nocheck
import { ImagenAdapter } from "./imagen"
import { DalleAdapter } from "./dalle"
import type { ImageProviderAdapter, ImageRequest, ImageResponse } from "./types"
import fs from "node:fs"
import path from "node:path"

const IS_DEV = process.env.NODE_ENV === "development"
const BUDGET_FILE = path.join(process.cwd(), "prisma", "gpt-image-budget.json")

/** GPT Image budget tracking — $0.04/image, $10 limit = 250 images. Persisted to disk. */
const GPT_IMAGE_BUDGET = {
  maxImages: 250,
  costPerImage: 0.04,
  used: loadBudget(),
  exhausted: false,
}
GPT_IMAGE_BUDGET.exhausted = GPT_IMAGE_BUDGET.used >= GPT_IMAGE_BUDGET.maxImages

function loadBudget(): number {
  try {
    const data = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf8"))
    return data.used ?? 0
  } catch {
    return 0
  }
}

function saveBudget(used: number) {
  try {
    fs.writeFileSync(BUDGET_FILE, JSON.stringify({ used, updatedAt: new Date().toISOString() }))
  } catch { /* non-critical */ }
}

export function getGptImageBudget() {
  return {
    used: GPT_IMAGE_BUDGET.used,
    remaining: GPT_IMAGE_BUDGET.maxImages - GPT_IMAGE_BUDGET.used,
    spent: +(GPT_IMAGE_BUDGET.used * GPT_IMAGE_BUDGET.costPerImage).toFixed(2),
    limit: +(GPT_IMAGE_BUDGET.maxImages * GPT_IMAGE_BUDGET.costPerImage).toFixed(2),
    exhausted: GPT_IMAGE_BUDGET.exhausted,
  }
}

function trackGptImageUse(): boolean {
  if (GPT_IMAGE_BUDGET.used >= GPT_IMAGE_BUDGET.maxImages) {
    GPT_IMAGE_BUDGET.exhausted = true
    return false
  }
  GPT_IMAGE_BUDGET.used++
  saveBudget(GPT_IMAGE_BUDGET.used)
  const spent = (GPT_IMAGE_BUDGET.used * GPT_IMAGE_BUDGET.costPerImage).toFixed(2)
  console.log(`[image-budget] GPT Image #${GPT_IMAGE_BUDGET.used}/${GPT_IMAGE_BUDGET.maxImages} ($${spent}/$${(GPT_IMAGE_BUDGET.maxImages * GPT_IMAGE_BUDGET.costPerImage).toFixed(2)})`)
  if (GPT_IMAGE_BUDGET.used >= GPT_IMAGE_BUDGET.maxImages) {
    GPT_IMAGE_BUDGET.exhausted = true
    console.warn("⚠️  [BUDGET EXHAUSTED] GPT Image budget of $10.00 (250 images) has been reached. Fallback disabled.")
  }
  return true
}

/**
 * Image provider with explicit fallback and budget tracking.
 *
 * Priority:
 * 1. Imagen (Google) — free with Google AI key
 * 2. GPT Image (OpenAI) — $0.04/image, budget-capped at $10 (250 images)
 */
class FallbackImageProvider implements ImageProviderAdapter {
  readonly name = "fallback"
  private primary: ImageProviderAdapter
  private fallback: ImageProviderAdapter | null
  private primaryFailed = false

  constructor(primary: ImageProviderAdapter, fallback: ImageProviderAdapter | null) {
    this.primary = primary
    this.fallback = fallback
  }

  async generate(request: ImageRequest): Promise<ImageResponse> {
    if (!this.primaryFailed) {
      try {
        return await this.primary.generate(request)
      } catch (err) {
        const detail = (err as { providerDetail?: string }).providerDetail ?? ""
        const msg = (err as Error).message ?? ""
        const isBillingOrQuota =
          detail.includes("paid plan") ||
          detail.includes("quota") ||
          detail.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("(400)") ||
          msg.includes("(429)")

        const isProviderUnavailable = isBillingOrQuota ||
          msg.includes("no image data") ||
          msg.includes("not found") ||
          msg.includes("not supported")

        if (isProviderUnavailable) {
          this.primaryFailed = true
          console.warn(`[image] Imagen unavailable: ${msg}`)
          return this.tryFallback(request)
        }
        throw err
      }
    }

    return this.tryFallback(request)
  }

  private async tryFallback(request: ImageRequest): Promise<ImageResponse> {
    if (!this.fallback || process.env.ALLOW_PAID_IMAGE_FALLBACK !== "true") {
      throw new Error(
        "Image generation unavailable. Imagen requires a paid Google AI plan. " +
        "Set ALLOW_PAID_IMAGE_FALLBACK=true in .env.local to use GPT Image ($0.04/image)."
      )
    }

    if (GPT_IMAGE_BUDGET.exhausted) {
      throw new Error(
        `GPT Image budget exhausted (${GPT_IMAGE_BUDGET.used}/${GPT_IMAGE_BUDGET.maxImages} images, $${(GPT_IMAGE_BUDGET.used * GPT_IMAGE_BUDGET.costPerImage).toFixed(2)} spent). ` +
        "Imagen is the primary provider — GPT Image fallback has reached its $10 budget cap."
      )
    }

    if (!trackGptImageUse()) {
      throw new Error("GPT Image budget exhausted.")
    }

    if (IS_DEV) {
      console.warn(`⚠️  [COST] GPT Image — ~$0.04 charged to OpenAI`)
    }

    return this.fallback.generate(request)
  }
}

let _imageProvider: ImageProviderAdapter | null = null

export function getImageProvider(): ImageProviderAdapter {
  if (_imageProvider) return _imageProvider

  const googleKey = process.env.GOOGLE_AI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  const primary = googleKey ? new ImagenAdapter(googleKey) : null
  const fallback = openaiKey ? new DalleAdapter(openaiKey) : null

  if (!primary && !fallback) {
    throw new Error("No image provider configured — set GOOGLE_AI_API_KEY or OPENAI_API_KEY")
  }

  if (primary && fallback) {
    _imageProvider = new FallbackImageProvider(primary, fallback)
  } else if (primary) {
    _imageProvider = primary
  } else {
    // Only GPT Image available — still require explicit opt-in + budget
    _imageProvider = {
      name: "dalle-gated",
      async generate(request: ImageRequest): Promise<ImageResponse> {
        if (process.env.ALLOW_PAID_IMAGE_FALLBACK !== "true") {
          throw new Error(
            "GPT Image generation costs ~$0.04/image. Set ALLOW_PAID_IMAGE_FALLBACK=true in .env.local to enable."
          )
        }
        if (GPT_IMAGE_BUDGET.exhausted || !trackGptImageUse()) {
          throw new Error("GPT Image budget exhausted ($10 / 250 images).")
        }
        if (IS_DEV) {
          console.warn(`⚠️  [COST] GPT Image — ~$0.04 charged to OpenAI`)
        }
        return fallback!.generate(request)
      },
    }
  }

  return _imageProvider
}

export type { ImageRequest, ImageResponse, ImageProviderAdapter } from "./types"
