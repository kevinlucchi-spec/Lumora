# Claude Code Master Prompt — Multi-AI Bedtime Story App

You are Claude Code acting as a senior full-stack engineer, systems architect, AI orchestration designer, data modeler, and pragmatic product builder.

Your job is to design and begin building a **from-scratch Bedtime Story App** with a **multi-AI backend**, strong continuity controls, image generation support, branching storylines, and selective social sharing/reuse mechanics.

Do not treat this as a toy demo unless absolutely necessary for the first scaffold. Build with real architecture in mind, even if the first implementation is an MVP.

At the same time, do **not** become rigid or overengineered. You have permission to make thoughtful design decisions, simplify where appropriate, and deviate from any specific suggestion below when there is a clearly better engineering or product choice. When you deviate, do it intentionally and explain why.

The ideal mindset is:
- strong architecture
- practical tradeoffs
- modular systems
- JSON-first contracts
- clear auditability
- product taste
- freedom to improve the design where needed

---

## 1. Product Vision

This app is **not** just a one-shot story generator.

It is a **story universe engine** that allows users to:
- create recurring characters
- generate bedtime stories with optional illustrations
- maintain continuity across stories
- fork stories into alternate branches/timelines
- organize stories into series/volumes/branches
- use multiple AI providers in specialized roles
- selectively mark content as shareable
- allow other users to discover and reuse certain shared assets/elements while keeping other items private

The product should feel like a hybrid of:
- a private bedtime story studio
- a continuity-aware story universe manager
- a reusable creative asset library
- a controlled, opt-in social sharing system

Everything should be private by default unless explicitly marked shareable.

---

## 2. High-Level Product Requirements

Build an app that can support the following major capabilities:

### Story generation
- Generate bedtime stories from prompts, themes, characters, and settings.
- Support age-banding and bedtime-safe tone controls.
- Support multiple story modes such as calm bedtime, cozy adventure, lesson/moral, dreamlike, sibling/family, continuation, and what-if branch.

### Continuity
- Preserve continuity across a series or branch.
- Distinguish between reusable character essence and continuity-bound character state.
- Support canon checking and contradiction detection.

### Branching
- Allow stories to branch from earlier stories.
- Allow alternate timelines / what-if continuations.
- Keep branch inheritance rules clear and enforceable.

### Images
- Generate scene-based illustrations tied to story pages or moments.
- Avoid raw story-to-image prompting where possible; use a scene extraction / visual direction layer.
- Store prompts, metadata, and image assets in a traceable way.

### Multi-AI orchestration
- Use different AI providers for different roles.
- Make providers pluggable and capability-based rather than hardcoded all over the app.

### Selective sharing and reuse
- Users can mark some content as shareable and keep other content private.
- Shared elements should be reusable by other users in controlled ways.
- Reuse should preserve provenance and permissions.
- This is **not** a broad open social feed first. It is a selective creative sharing system.

### Auditability
- Every generation run should be traceable.
- Prompt versions, model choices, validation results, and generated outputs should be inspectable.

---

## 3. Important Product Philosophy

Please follow these principles unless you identify a clearly better approach:

1. **Do not design this around a single “magic AI.”**
   Treat the AIs as specialized workers in a pipeline.

2. **Do not let every model do everything.**
   Define roles.

3. **Do not make the system so rigid that it becomes brittle.**
   Keep architecture strong, but allow thoughtful flexibility.

4. **Do not build the social layer like a chaotic public social network.**
   The social/reuse model should feel controlled, opt-in, and useful.

5. **Do not overcomplicate the MVP with every possible feature.**
   But do architect so the app can grow cleanly.

6. **Prefer modularity, typed schemas, and clear contracts over cleverness.**

7. **Use structured data and JSON contracts heavily.**

8. **Private by default. Shareable by explicit user action.**

---

## 4. AI Providers Available

Assume the backend can access:
- Anthropic / Claude API
- OpenAI API
- Gemini API / AI Studio
- xAI API
- image generation through appropriate providers/tools

These provider roles are suggestions, not hard mandates. You may refine them if you can justify a better arrangement.

### Suggested role model
- **Claude / Anthropic**: primary story writer
- **OpenAI**: structured validator / continuity checker / repair planner
- **Gemini**: visual director, multimodal scene interpreter, image-prompt pack builder
- **xAI**: optional critic, comparator, ranker, or variant generator

If you think a different assignment is better for implementation, structure the system so provider roles are configurable.

---

## 5. Core Domain Model

Please design around a narrative hierarchy similar to the following, but you may refine naming or shape if there is a better implementation:

### Series
Top-level universe or franchise.

### Branch
A timeline path within a series.

### Volume
A grouping/installment inside a branch.

### Story
An individual story entry.

### Character Template
A reusable essence/core definition of a character.

### Character Instance
A continuity-bound version of a character within a specific series and/or branch.

This distinction is very important:
- a character template is reusable
- a character instance carries actual continuity state

That prevents continuity chaos when users want to reuse a character concept across different universes or branches.

---

## 6. Three Memory Layers

The system should preserve a clear separation between:

### Character Memory
Stable facts and evolving state for a character instance.

### Story / Branch Memory
Facts true because of events that happened in the current continuity path.

### World / Canon Memory
Rules of the universe/series, tone rules, setting logic, magic rules, etc.

Please preserve this separation in architecture and data modeling.

---

## 7. Selective Social Sharing and Reuse

This is an important addition.

I want the app to support a **controlled sharing and reuse model** where users can selectively mark certain things as shareable and other things as private.

Examples of elements that may be shareable:
- character templates
- world/setting templates
- art style presets
- story prompts / seeds
- story frameworks / outline structures
- entire stories, if user explicitly allows it
- series bibles or selected lore components
- illustration prompt packs or scene style packs
- moral/theme templates

Examples of things that may remain private:
- family-specific stories
- private character instances
- continuity history
- child-specific personalization
- unpublished works
- generation logs

Other users should be able, where permitted, to:
- discover shared items
- import/reuse them into their own library
- fork or remix them if permissions allow
- preserve attribution/provenance
- create their own derivative assets

Please design a permission model that supports concepts like:
- private
- unlisted/share-via-link
- public reusable
- public view-only
- remix/fork allowed vs not allowed
- attribution required

This does **not** need to become a giant open social-media feed in MVP.
The preferred direction is:
- selective discovery
- reusable creative building blocks
- controlled sharing
- opt-in community layer

Think of it more like a “creative asset commons with permissions” than a mainstream social feed.

Please include this in the architecture, data model, UX, and MVP/V2 recommendations as appropriate.

---

## 8. UX and Product Principles for Sharing

The sharing layer should feel intentional and safe.

Desired principles:
- default to private
- easy to mark specific things as shareable
- clear explanation of what gets shared
- clear attribution/provenance trail
- ability to import a shared template without importing someone else’s full continuity state
- strong distinction between reusable template objects and private continuity objects
- ability to browse useful shared assets later without making the whole product feel like noisy social media

If helpful, introduce concepts like:
- shared template library
- public asset gallery
- importable starter kits
- reusable series seeds
- character template marketplace/community library later on

---

## 9. Technical Architecture Expectations

You have flexibility in implementation, but I want a modern, serious architecture.

Preferred stack direction:
- Next.js
- TypeScript
- PostgreSQL
- Prisma
- Redis-backed queue or equivalent job system
- S3-compatible object storage for images/assets
- modular provider adapters
- strong runtime schemas, preferably Zod

If you believe a different setup is materially better, you may propose it, but keep the spirit of modern, maintainable, production-minded architecture.

Please avoid overengineering too early. Strong MVP architecture is more important than maximal complexity.

---

## 10. Provider Abstraction Layer

Please build or scaffold a provider abstraction layer.

Do not scatter raw provider calls all over the codebase.

Think in terms of capabilities such as:
- generate outline
- generate story draft
- validate outline
- validate story
- generate repair plan
- extract scene specs
- generate image
- rank or compare candidates

Each provider adapter should normalize:
- request construction
- schema expectations
- retries/timeouts
- response parsing
- usage metadata
- error handling

The exact interface is up to you, but it should be clean and extensible.

---

## 11. Orchestration Pipeline Expectations

Please design a multi-step generation pipeline roughly along these lines, with freedom to improve:

1. request intake
2. request normalization
3. context retrieval
4. outline generation
5. outline validation
6. outline repair if needed
7. story generation
8. story validation
9. targeted repair loop if needed
10. scene extraction for illustrations
11. scene validation if appropriate
12. image generation
13. image QA if appropriate
14. persistence of outputs and run logs
15. delivery to frontend

Important principles:
- validate early
- repair locally when possible
- do not rewrite the whole story when only one section failed
- log each step
- cap retry/repair loops

---

## 12. Story and Safety Requirements

This is a bedtime story app, so build in explicit support for:
- age-banding
- tone presets
- bedtime-safe story modes
- reassurance and calm ending patterns where applicable
- conflict intensity control
- vocabulary complexity control
- story length / reading time controls

The system should support modes such as:
- calm bedtime
- cozy adventure
- moral/lesson story
- dreamlike / surreal
- sibling/family story
- continuation story
- what-if branch
- user-guided custom story

Please build a validation layer that can detect issues like:
- age mismatch
- tone mismatch
- canon conflict
- timeline conflict
- branch leakage
- unresolved prompt requirements
- image-scene mismatch
- excessive intensity for bedtime mode

---

## 13. Image Generation Expectations

Please do not treat image generation as a raw afterthought.

Preferred approach:
- approved story gets broken into scene specs
- scene specs drive image prompt generation
- image generation is tied to those scene specs
- assets and prompts are stored with traceability

Please support the concept of:
- style presets
- character appearance locks
- environment consistency
- negative prompts / avoid blocks where appropriate
- metadata for image generation

If helpful, implement image generation as optional for MVP but architect it cleanly.

---

## 14. Auditability / Generation Runs

This is very important.

Every generation run should be inspectable and log things like:
- user request payload
- normalized request
- context pack used
- prompt versions used
- provider/model used per phase
- raw and parsed outputs where appropriate
- validation reports
- repair instructions
- token/cost/latency metadata if available
- final accepted outputs
- errors/fallbacks/retries

This should not necessarily all be user-facing in MVP, but it should exist in the architecture and preferably in admin/debug UI.

---

## 15. Recommended Permission and Shareability Concepts

Please incorporate a permissions layer for shareability. Use your judgment on naming and implementation.

Potential shareability states:
- private
- unlisted
- public view-only
- public reusable
- public reusable with attribution
- remix/fork allowed or disallowed

Potential reusable entity types:
- character template
- world template
- art style preset
- story prompt seed
- outline template
- series starter kit
- story package

Please preserve provenance when something is imported/reused.
For example:
- original creator
- original asset id
- imported copy id
- whether derivative/forked/remixed
- attribution rules

Please think carefully about where inheritance and reuse should stop.
For example:
- a user can import a shared character template
- but they should not inherit another user’s private branch memory
- a user can import a world template
- but should create their own series instance/state

---

## 16. MVP Scope Guidance

Please use judgment, but I want a realistic MVP that proves the core idea.

A good MVP likely includes:
- auth
- series CRUD
- branch CRUD
- character template CRUD
- character instance support
- story generation pipeline
- continuity-aware context retrieval
- validation and repair loops
- story reader UI
- image pipeline scaffold or first-pass implementation
- generation run logging
- branch fork flow
- selective shareability settings on relevant entities
- ability to browse/import selected shared templates/assets

A good MVP probably does **not** need all of the following immediately:
- giant social feed
- comments/likes/follows ecosystem
- live collaboration
- full publishing marketplace
- voice/audio narration
- animated storybooks
- advanced recommendation engine

Please separate:
- MVP
- nice-to-have for MVP
- V2
- V3/future optional ideas

---

## 17. Freedom to Design

This is important: I do **not** want you to be a passive stenographer.

You have permission to:
- improve naming
- improve data modeling
- improve folder structure
- improve service boundaries
- simplify weak ideas
- challenge overcomplicated assumptions
- propose better defaults
- choose reasonable abstractions
- make pragmatic architectural decisions

But do not wander away from the core product intent.

When there are tradeoffs, prefer:
- maintainability
- clarity
- scalability of design
- debuggability
- modularity
- product usefulness

---

## 18. What I Want You to Produce First

Before writing large amounts of implementation code, I want you to first produce a serious technical plan.

### Step 1: Architecture and Planning
Produce:
1. a high-level architecture overview
2. a proposed tech stack and rationale
3. the domain model
4. the database schema proposal
5. the provider abstraction design
6. the orchestration pipeline design
7. the shareability/permissions model
8. the frontend information architecture
9. the MVP / V2 / V3 roadmap
10. the folder/file structure proposal
11. the API route / service design
12. the runtime schema strategy
13. the job queue / worker design
14. the observability and run-logging plan

### Step 2: Scaffold and Core Implementation
Then begin implementing the project in a thoughtful order.

Suggested order, but you may improve it:
1. project scaffold
2. auth and app shell
3. database + Prisma schema
4. domain types + runtime schemas
5. CRUD for core entities
6. provider adapters
7. orchestration scaffolding
8. story generation pipeline
9. validation/repair system
10. story reader UI
11. branching/forking flows
12. shareability/import flows
13. image pipeline
14. admin/debug run inspection

---

## 19. Deliverable Style

As you work:
- think like a builder, not a theorist
- be explicit about tradeoffs
- do not produce shallow scaffolding with no real architecture
- do not hide core logic in vague placeholders if it can be designed concretely
- however, it is acceptable to scaffold external provider wiring where secrets or environment setup are required

When choices are uncertain, choose a strong default and note the alternative.

---

## 20. Important Domain Behaviors to Preserve

Please preserve the spirit of these behaviors:

- characters can be reused across universes/series as templates, but continuity state should not automatically leak across universes
- branches inherit canon only up to the fork point
- continuity checking should happen before and after story generation
- image generation should be driven by structured scene specs
- the system should store enough metadata to debug multi-AI failures later
- sharing should be selective and permissioned
- import/reuse should preserve provenance
- private family or child-specific content should not accidentally become public

---

## 21. Strong Recommendation on JSON-First Design

Please model the system so that major AI-driven artifacts can be represented as structured JSON, such as:
- normalized request
- context pack
- outline
- story pages
- continuity report
- scene specs
- image generation metadata
- generation run summary

These JSON contracts should be versionable and validated.

---

## 22. Suggested Example Entity Types for Sharing

Please consider support for shareability flags or policies on entities such as:
- character templates
- world templates
- art style presets
- story prompt seeds
- outline/story frameworks
- series starter kits
- completed stories, if user allows

Please be careful about entities that should likely remain private by default or not directly shareable as-is, such as:
- character instances with private continuity state
- branch memory
- family-specific metadata
- generation logs
- private personalization layers

You may choose a more elegant technical implementation than simple flags if appropriate.

---

## 23. What I Value Most

Optimize for the following:
1. strong architecture
2. practical buildability
3. good product taste
4. continuity-aware design
5. modular multi-AI orchestration
6. selective social/reuse mechanics done cleanly
7. debuggability and traceability
8. room to grow without rewriting the whole system

---

## 24. Final Instruction

Start by producing the architecture/plan package first, then proceed into implementation in a sensible sequence.

Be proactive, thoughtful, and willing to improve the design where needed.
Do not be unnecessarily rigid.
Do not be sloppy.
Do not collapse the multi-AI concept into a single-model shortcut.
Do not turn the sharing layer into a noisy generic social feed.

Build a serious foundation for a **private-first, selectively shareable, multi-AI bedtime story platform**.
