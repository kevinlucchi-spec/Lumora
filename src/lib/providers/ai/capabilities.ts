// @ts-nocheck
import type { ProviderConfig } from "./types"

export type AICapability =
  | "generate:outline"
  | "generate:story-draft"
  | "generate:repair-plan"
  | "generate:image-prompt-repair"
  | "validate:outline"
  | "validate:story"
  | "validate:continuity"
  | "extract:scene-specs"
  | "generate:image-prompt-pack"
  | "qa:image-scene"
  | "qa:image-character"
  | "rank:candidates"
  | "generate:story-variant"

export const CAPABILITY_REGISTRY: Record<AICapability, ProviderConfig> = {
  "generate:outline":              { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  "generate:story-draft":          { provider: "anthropic", model: "claude-sonnet-4-6" },
  "generate:repair-plan":          { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  "generate:image-prompt-repair":  { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  "validate:outline":              { provider: "openai",    model: "gpt-4o" },
  "validate:story":                { provider: "openai",    model: "gpt-4o" },
  "validate:continuity":           { provider: "openai",    model: "gpt-4o" },
  "extract:scene-specs":           { provider: "gemini",    model: "gemini-2.5-flash" },
  "generate:image-prompt-pack":    { provider: "gemini",    model: "gemini-2.5-flash" },
  "qa:image-scene":                { provider: "openai",    model: "gpt-4o" },
  "qa:image-character":            { provider: "xai",       model: "grok-2-1212" },
  "rank:candidates":               { provider: "xai",       model: "grok-2-1212" },
  "generate:story-variant":        { provider: "xai",       model: "grok-2-1212" },
}
