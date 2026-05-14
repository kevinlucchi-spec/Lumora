// @ts-nocheck
import { z } from "zod"

export const SharePolicySchema = z.enum([
  "PRIVATE",
  "UNLISTED",
  "PUBLIC_VIEW",
  "PUBLIC_REUSE",
  "PUBLIC_REMIX",
])

export type SharePolicy = z.infer<typeof SharePolicySchema>
