import { z } from "zod"

export const ValidationIssueSchema = z.object({
  type: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  location: z.string().optional(),
  description: z.string(),
})

export const ValidationReportSchema = z.object({
  step: z.string(),
  passed: z.boolean(),
  issues: z.array(ValidationIssueSchema),
  repairSuggestions: z.array(z.string()).optional(),
})

export const PipelineLogEntrySchema = z.object({
  step: z.string(),
  status: z.enum(["started", "completed", "failed", "skipped"]),
  durationMs: z.number().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  tokenUsage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
  }).optional(),
  error: z.string().optional(),
})

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>
export type ValidationReport = z.infer<typeof ValidationReportSchema>
export type PipelineLogEntry = z.infer<typeof PipelineLogEntrySchema>
