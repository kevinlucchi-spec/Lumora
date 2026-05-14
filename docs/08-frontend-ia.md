# Frontend Information Architecture

## Route Structure

```
/                           → Landing / marketing
/login                      → Auth (email magic link)
/register                   → Register

(authenticated)
/dashboard                  → Home — recent series, quick actions
/library                    → Personal library (templates, presets, seeds)
/discover                   → Browse shared public assets

/series                     → List of all user series
/series/new                 → Create series wizard
/series/[seriesId]          → Series overview (branches, characters)
/series/[seriesId]/canon    → World canon editor
/series/[seriesId]/characters → Character instances list
/series/[seriesId]/characters/new → Add character (from template or scratch)

/series/[seriesId]/branches/[branchId]
  → Branch view (volumes + stories)
/series/[seriesId]/branches/[branchId]/stories/new
  → Story generation form
/series/[seriesId]/branches/[branchId]/stories/[storyId]
  → Story reader
/series/[seriesId]/branches/[branchId]/stories/[storyId]/fork
  → Fork into new branch

/library/characters          → My character templates
/library/characters/new      → Create character template
/library/characters/[id]     → Edit template + shareability settings
/library/worlds              → My world templates
/library/art-styles          → My art style presets
/library/prompt-seeds        → My story prompt seeds

/discover                    → Browse public assets (tabbed: characters, worlds, styles, seeds)
/discover/[type]/[id]        → Preview a shared asset + import button

/runs/[runId]                → Generation run inspector (debug/admin)

/settings                    → Account settings
/settings/api-keys           → Provider API key management
```

---

## Page Breakdown

### Dashboard (`/dashboard`)
- Recent series cards with last story date
- In-progress generation status (if job running)
- Quick action: "New Story" → series/branch picker
- Highlight: recent imports from library

### Series Overview (`/series/[id]`)
- Series name, description, world template
- Branch tree visualization (main + forks)
- Character instances grid with memory state peek
- "New Branch" and "New Story" CTAs

### Story Generator (`/stories/new`)
- Multi-step form:
  1. Choose mode + age band
  2. Write or select a prompt (or pick a seed)
  3. Select characters
  4. Choose art style preset
  5. Advanced options (length, tone override, image toggle)
- "Generate" triggers job, shows real-time progress

### Story Reader (`/stories/[id]`)
- Page-by-page reader
- Illustrations alongside text
- "Fork from here" button
- Share settings panel
- Generation run link (debug)

### Library
- Tabbed grid views for each template type
- SharePolicy badge on each card
- Quick toggle for sharing settings
- "Import" CTA on discoverable assets

### Discover
- Filterable grid: type, tags, age band, mode
- Preview panel (drawer or modal) before import
- Import confirmation with attribution notice

### Generation Run Inspector (`/runs/[id]`)
- Timeline of pipeline steps with duration
- Per-step: provider used, model, token count, input/output
- Validation reports (passed/failed, issues)
- Repair rounds (before/after)
- Raw JSON viewer for each artifact
- Error log

---

## UI Component Strategy

### Key Components
- `StoryReader` — page renderer with image + text layout
- `PipelineProgress` — real-time step indicator during generation
- `CharacterCard` — template vs instance display variants
- `SharePolicyBadge` — visual indicator for each policy level
- `MemoryStatePanel` — displays character current state
- `BranchTree` — visual tree of series branches
- `ProviderLog` — run inspector timeline component

### State Management
- **Server Components** for initial data loads (series, stories, library)
- **Client Components** for interactive forms and real-time updates
- **React Query (TanStack Query)** for client-side data fetching and cache
- **Server-Sent Events** or polling for generation job progress

### Layout
- Root layout: sidebar navigation + main content
- Sidebar: series picker, library nav, discover
- Top bar: user menu, notifications, quick-new button
- Content: full-width with max-w-5xl container

---

## Progressive Disclosure

Complex features are hidden until needed:
- Canon editor: accessible from series, not prominent on dashboard
- Generation run inspector: linked from story but not primary UI
- Advanced tone overrides: in collapsible "Advanced" section
- Remix/attribution details: visible on hover/expand
