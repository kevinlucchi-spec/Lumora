# Domain Model

## Entity Map

```
User
 ├── Series[]                          (top-level story universe)
 │    ├── Branch[]                     (timeline/continuity path)
 │    │    ├── Volume[]               (installment grouping)
 │    │    │    └── Story[]           (individual story)
 │    │    │         ├── SceneSpec[]  (extracted visual moments)
 │    │    │         └── ImageAsset[] (generated illustrations)
 │    │    └── BranchMemory           (events true in this timeline)
 │    ├── CharacterInstance[]          (continuity-bound character state)
 │    └── WorldInstance               (series-bound world state)
 │
 ├── CharacterTemplate[]               (reusable character essence)
 ├── WorldTemplate[]                   (reusable world/setting definition)
 ├── ArtStylePreset[]                  (shareable visual style specs)
 └── StoryPromptSeed[]                 (shareable prompt ideas)
```

---

## Entity Definitions

### User
Owner of all private content. Auth boundary.

### Series
Top-level creative universe. One user owns it. Contains branches, character instances, and one world instance.

A series has:
- A name and description
- A `WorldCanon` (tone rules, lore, setting logic for this universe)
- One or more branches (always at least one "main" branch)
- All `CharacterInstance` records for this universe

**Design decision:** Series is the continuity root. Characters exist at series level, not branch level, because a character's identity spans timelines — only their state diverges per branch.

### Branch
A timeline within a series. The "main" branch is created automatically. Any story can be a fork point for a new branch.

A branch has:
- An optional `parentBranchId` and `forkFromStoryId` (fork point)
- A `BranchMemory` (events that happened in this timeline)
- An `isCanon` flag

**Branch inheritance rule:** A forked branch inherits all world canon and character state *up to the fork story*. Events after the fork point in the parent branch do not propagate to the child branch.

### Volume
A named grouping of stories within a branch. Analogous to a book in a series. Optional but useful for organization.

### Story
An individual bedtime story. Contains:
- Structured content (`Json` — array of pages with text and optional image reference)
- `StoryMode` (calm_bedtime, cozy_adventure, moral_lesson, dreamlike, sibling_family, continuation, what_if_branch, custom)
- `AgeBand` (toddler 2-4, early 4-6, middle 6-8, tween 8-10, preteen 10-12)
- `SharePolicy`
- Link to its `GenerationRun`

### CharacterTemplate
A **reusable, user-owned** character definition. This is the *essence* — name, personality archetype, appearance description, voice, behavioral traits.

It is NOT continuity-bound. It can be imported/reused by other users (if shared). It has no memory state.

### CharacterInstance
A **continuity-bound** instantiation of a CharacterTemplate within a specific Series. This is where state lives — what happened to this character, how they've grown, their current relationships.

A character instance belongs to a Series, not a Branch. Branch-specific divergences are stored in `branchOverrides` (JSON keyed by branchId).

**This separation is critical:** It lets users reuse a character concept across different universes without contaminating continuity.

### WorldTemplate
Reusable world/setting definition — climate, geography, cultural rules, magic system, tone guidance. No instance state.

### WorldInstance
A series-bound instantiation of a WorldTemplate. Carries series-specific lore evolution.

### WorldCanon
Per-series truth — the accumulated rules, events, and lore that are canon for this universe. Separate from WorldInstance to allow richer querying.

### BranchMemory
All events that are true *in this branch*. Structured as facts + an ordered event log. Used for continuity checking and context retrieval.

### CharacterMemory
Per-character-instance memory. Contains:
- `stableFacts`: things that never change (born in X, original home is Y)
- `evolvingState`: current status (has sword, lives with friend, afraid of water)
- `eventLog`: history of state changes, keyed to storyId

### ArtStylePreset
A named visual style specification. Contains style keywords, color palette guidance, medium (watercolor, storybook, etc), negative terms. Used to generate consistent image prompts.

### StoryPromptSeed
A saved story idea — a prompt string, themes, suggested modes. Shareable.

### GenerationRun
Full audit record for every pipeline execution. See observability doc.

### SceneSpec
A structured extraction of a visual moment from a story. Drives image generation. Contains characters present, setting, mood, and the derived image prompt.

### ImageAsset
A generated illustration. Linked to a SceneSpec and optionally a Story. Stores the storage key (S3), the prompt used, provider, model, and generation metadata.

---

## Key Distinctions to Preserve

| Template | Instance |
|----------|----------|
| User-owned, reusable | Series-bound, continuity-carrying |
| Shareable | Private by default |
| No memory state | Has memory state |
| Can be imported | Imported separately |

| BranchMemory | WorldCanon | CharacterMemory |
|---|---|---|
| Events in this timeline | Rules of the universe | State of this character |
| Branch-scoped | Series-scoped | Character-instance-scoped |
| Changes per story | Changes rarely | Changes per story |
