// @ts-nocheck
import { z } from "zod"

export const VisualProfileSchema = z.object({
  physicalDescription: z.object({
    height: z.string().optional(),
    build: z.string().optional(),
    hairColor: z.string().optional(),
    hairStyle: z.string().optional(),
    eyeColor: z.string().optional(),
    skinTone: z.string().optional(),
    age: z.string().optional(),
    species: z.string().default("human"),
  }),
  clothingDefaults: z.object({
    outfit: z.string().optional(),
    accessories: z.array(z.string()).default([]),
    colors: z.array(z.string()).default([]),
  }).optional(),
  distinguishingFeatures: z.array(z.string()).default([]),
  artStyleNotes: z.string().optional(),
})

export type VisualProfile = z.infer<typeof VisualProfileSchema>

/**
 * Build an image-prompt-friendly description string from a visual profile.
 * Used to inject character appearance into every image prompt for consistency.
 */
export function visualProfileToPromptFragment(name: string, profile: VisualProfile): string {
  const parts: string[] = [`${name}:`]

  const phys = profile.physicalDescription
  const physParts: string[] = []
  if (phys.species && phys.species !== "human") physParts.push(phys.species)
  if (phys.age) physParts.push(phys.age)
  if (phys.build) physParts.push(phys.build)
  if (phys.height) physParts.push(phys.height)
  if (phys.skinTone) physParts.push(`${phys.skinTone} skin`)
  if (phys.hairColor || phys.hairStyle) {
    physParts.push([phys.hairColor, phys.hairStyle].filter(Boolean).join(" ") + " hair")
  }
  if (phys.eyeColor) physParts.push(`${phys.eyeColor} eyes`)
  if (physParts.length > 0) parts.push(physParts.join(", "))

  if (profile.clothingDefaults?.outfit) {
    parts.push(`Wearing ${profile.clothingDefaults.outfit}`)
    if (profile.clothingDefaults.accessories.length > 0) {
      parts.push(`with ${profile.clothingDefaults.accessories.join(", ")}`)
    }
  }

  if (profile.distinguishingFeatures.length > 0) {
    parts.push(`Notable: ${profile.distinguishingFeatures.join(", ")}`)
  }

  if (profile.artStyleNotes) {
    parts.push(`Style notes: ${profile.artStyleNotes}`)
  }

  return parts.join(". ")
}
