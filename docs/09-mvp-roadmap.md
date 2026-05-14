# MVP / V2 / V3 Roadmap

## MVP — Proves the Core Product

**Goal:** A working private story universe engine with multi-AI generation, continuity awareness, selective sharing, and basic image support.

### MVP Features

**Auth & Account**
- Email magic link auth (NextAuth)
- Account settings page
- API key management (user provides own provider keys at MVP)

**Series, Branch, Volume, Story CRUD**
- Full hierarchy management
- Branch forking from any story
- Series overview with branch tree

**Characters**
- Character template creation and editing
- Character instance management per series
- Character memory state displayed post-story

**World**
- World template CRUD
- World instance per series
- World canon editor (basic)

**Story Generation**
- Multi-step pipeline (all 15 steps)
- Mode selection (all 7 modes)
- Age band controls
- Story reader UI
- Real-time progress during generation (polling)

**Validation & Repair**
- Outline and story validation via OpenAI
- Targeted repair loops with cap
- Generation run logging

**Images**
- Scene extraction via Gemini
- DALL·E 3 image generation (optional per story)
- Images displayed in story reader

**Memory**
- Character memory updated after each story
- Branch memory maintained
- World canon updates

**Selective Sharing**
- SharePolicy on: CharacterTemplate, WorldTemplate, ArtStylePreset, StoryPromptSeed, Story
- Import flow for PUBLIC_REUSE/PUBLIC_REMIX assets
- Provenance tracking
- Basic discovery browse page

**Admin/Debug**
- Generation run inspector page
- Per-step logs, validation reports, token usage

---

## V2 — Deepens the Platform

**Goal:** Community layer, better UX polish, richer continuity tooling.

- Creator profiles and attribution pages
- Usage analytics for shared assets ("12 imports")
- Featured/curated public collections
- Continuity conflict dashboard (visual timeline of character state changes)
- Side-by-side branch compare view
- Story revision history (re-generate with different settings)
- Custom prompt templates (user-defined system prompt overrides)
- Series starter kits (bundled templates for quick setup)
- Narration export (text export formatted for reading aloud)
- xAI variant generation ("show me 3 alternate endings")
- Rich text rendering in story reader (better typography, page transitions)
- Mobile-responsive story reader
- Notification system (generation complete, import activity)

---

## V3 / Future Optional

**Goal:** Platform expansion and monetization optionality.

- Voice/audio narration (ElevenLabs or similar TTS)
- Animated storybook renderer (CSS/canvas page turns)
- Collaborative series editing (multiple family members)
- Print-to-PDF export (formatted storybook layout)
- Public story publishing with full social graph (follows, likes, comments)
- Recommendation engine for shared assets
- Marketplace for premium character/world templates
- Organization accounts (classroom, library, etc.)
- Offline reading (PWA + local cache)
- Custom AI model fine-tuning (bring your own style)

---

## MVP Deliberately Excludes

- Social graph (follows, likes, comments, feeds)
- Live collaboration
- Voice narration
- Animated rendering
- Publishing marketplace
- Recommendation engine
- Fine-tuning
- Organization accounts

---

## Implementation Order (MVP)

1. Project scaffold + tooling
2. Auth + app shell + layout
3. Prisma schema + migrations
4. Zod schemas + TypeScript types
5. Series, branch, volume, story CRUD services + API routes
6. Character template + instance CRUD
7. World template + instance + canon CRUD
8. Provider adapters (Anthropic, OpenAI, Gemini, xAI)
9. Pipeline infrastructure (BullMQ, step runner, logging)
10. Story generation pipeline (all steps)
11. Story reader UI
12. Image pipeline
13. Branching/fork flow
14. Sharing + discovery + import flow
15. Generation run inspector
16. Polish + error handling
