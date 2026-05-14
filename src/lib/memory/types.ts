// @ts-nocheck
export interface CharacterMemorySnapshot {
  characterInstanceId: string
  characterName: string
  stableFacts: Record<string, unknown>
  evolvingState: Record<string, unknown>
  recentEvents: MemoryEvent[]
}

export interface MemoryEvent {
  storyId: string
  summary: string
  timestamp: string
}

export interface BranchMemorySnapshot {
  branchId: string
  facts: Record<string, unknown>
  recentEvents: BranchEvent[]
}

export interface BranchEvent {
  storyId: string
  summary: string
  timestamp: string
}

export interface WorldCanonSnapshot {
  seriesId: string
  rules: Record<string, unknown>
  lore: Record<string, unknown>
  toneGuide: Record<string, unknown>
}

export interface StorySnapshot {
  storyId: string
  title: string
  summary: string
  mode: string
  createdAt: string
}

export interface ToneGuide {
  mode: string
  ageBand: string
  intensity: "very_low" | "low" | "medium"
  vocabulary: "simple" | "moderate" | "advanced"
  endingStyle: "reassuring" | "wonder" | "lesson" | "open"
}

export interface ParentStoryContext {
  storyId: string
  title: string
  content: Array<{ pageNumber: number; text: string }>
  mode: string
  ageBand: string
}

export interface ContextPack {
  characterMemories: CharacterMemorySnapshot[]
  branchFacts: BranchMemorySnapshot
  worldCanon: WorldCanonSnapshot
  recentStories: StorySnapshot[]
  toneGuide: ToneGuide
  parentStory?: ParentStoryContext
}
