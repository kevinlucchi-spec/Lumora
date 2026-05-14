# Database Schema

Full Prisma schema. See `prisma/schema.prisma` for the implementation.

## Enums

```prisma
enum SharePolicy {
  PRIVATE           // only owner can see
  UNLISTED          // accessible via direct link, not discoverable
  PUBLIC_VIEW       // discoverable, read-only
  PUBLIC_REUSE      // discoverable, importable into own library
  PUBLIC_REMIX      // discoverable, importable, forkable with attribution
}

enum StoryMode {
  CALM_BEDTIME
  COZY_ADVENTURE
  MORAL_LESSON
  DREAMLIKE
  SIBLING_FAMILY
  CONTINUATION
  WHAT_IF_BRANCH
  CUSTOM
}

enum AgeBand {
  TODDLER   // 2–4
  EARLY     // 4–6
  MIDDLE    // 6–8
  TWEEN     // 8–10
  PRETEEN   // 10–12
}

enum RunStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  PARTIAL   // completed but with errors in non-critical steps (e.g. images failed)
}
```

## Core Models

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  series             Series[]
  characterTemplates CharacterTemplate[]
  worldTemplates     WorldTemplate[]
  artStylePresets    ArtStylePreset[]
  storyPromptSeeds   StoryPromptSeed[]
  generationRuns     GenerationRun[]
  importedAssets     ImportedAsset[]
}

model Series {
  id          String      @id @default(cuid())
  userId      String
  name        String
  description String?
  sharePolicy SharePolicy @default(PRIVATE)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  user               User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  branches           Branch[]
  characterInstances CharacterInstance[]
  worldInstance      WorldInstance?
  worldCanon         WorldCanon?

  @@index([userId])
}

model Branch {
  id               String   @id @default(cuid())
  seriesId         String
  name             String
  description      String?
  isCanon          Boolean  @default(true)
  parentBranchId   String?
  forkFromStoryId  String?
  sharePolicy      SharePolicy @default(PRIVATE)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  series        Series         @relation(fields: [seriesId], references: [id], onDelete: Cascade)
  parentBranch  Branch?        @relation("BranchForks", fields: [parentBranchId], references: [id])
  childBranches Branch[]       @relation("BranchForks")
  forkFromStory Story?         @relation("StoryForks", fields: [forkFromStoryId], references: [id])
  volumes       Volume[]
  branchMemory  BranchMemory?

  @@index([seriesId])
}

model Volume {
  id          String   @id @default(cuid())
  branchId    String
  name        String
  description String?
  order       Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  branch  Branch  @relation(fields: [branchId], references: [id], onDelete: Cascade)
  stories Story[]

  @@index([branchId])
  @@unique([branchId, order])
}

model Story {
  id             String      @id @default(cuid())
  volumeId       String
  title          String
  content        Json        // StoryContent — array of StoryPage
  mode           StoryMode
  ageBand        AgeBand
  sharePolicy    SharePolicy @default(PRIVATE)
  order          Int
  readingTimeMin Int?
  wordCount      Int?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  volume        Volume         @relation(fields: [volumeId], references: [id], onDelete: Cascade)
  forkedBranches Branch[]      @relation("StoryForks")
  generationRun GenerationRun?
  sceneSpecs    SceneSpec[]
  imageAssets   ImageAsset[]

  @@index([volumeId])
}
```

## Character Models

```prisma
model CharacterTemplate {
  id           String      @id @default(cuid())
  userId       String
  name         String
  description  String?
  essence      Json        // CharacterEssence — personality, appearance, voice, traits
  tags         String[]
  sharePolicy  SharePolicy @default(PRIVATE)
  provenanceId String?     // set if this was imported from another user
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  user        User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  instances   CharacterInstance[]
  provenance  SharedAssetProvenance? @relation(fields: [provenanceId], references: [id])

  @@index([userId])
  @@index([sharePolicy])
}

model CharacterInstance {
  id                  String   @id @default(cuid())
  seriesId            String
  characterTemplateId String
  nameOverride        String?  // if user wants a different name in this series
  memoryState         Json     // current continuity state
  branchOverrides     Json     @default("{}") // keyed by branchId
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  series            Series            @relation(fields: [seriesId], references: [id], onDelete: Cascade)
  characterTemplate CharacterTemplate @relation(fields: [characterTemplateId], references: [id])
  characterMemory   CharacterMemory?

  @@unique([seriesId, characterTemplateId])
  @@index([seriesId])
}

model CharacterMemory {
  id                  String   @id @default(cuid())
  characterInstanceId String   @unique
  stableFacts         Json     // immutable traits
  evolvingState       Json     // current state
  eventLog            Json     @default("[]") // array of MemoryEvent
  updatedAt           DateTime @updatedAt

  characterInstance CharacterInstance @relation(fields: [characterInstanceId], references: [id], onDelete: Cascade)
}
```

## World Models

```prisma
model WorldTemplate {
  id          String      @id @default(cuid())
  userId      String
  name        String
  description String?
  rules       Json        // WorldRules — climate, geography, magic, cultural norms
  toneGuide   Json        // tone/atmosphere guidance
  tags        String[]
  sharePolicy SharePolicy @default(PRIVATE)
  provenanceId String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  instances WorldInstance[]
  provenance SharedAssetProvenance? @relation(fields: [provenanceId], references: [id])

  @@index([userId])
  @@index([sharePolicy])
}

model WorldInstance {
  id              String   @id @default(cuid())
  seriesId        String   @unique
  worldTemplateId String
  state           Json     // series-specific accumulated lore
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  series        Series        @relation(fields: [seriesId], references: [id], onDelete: Cascade)
  worldTemplate WorldTemplate @relation(fields: [worldTemplateId], references: [id])
}

model WorldCanon {
  id        String   @id @default(cuid())
  seriesId  String   @unique
  rules     Json     // enforced canon rules
  lore      Json     // accumulated lore facts
  toneGuide Json     // series-level tone overrides
  updatedAt DateTime @updatedAt

  series Series @relation(fields: [seriesId], references: [id], onDelete: Cascade)
}

model BranchMemory {
  id        String   @id @default(cuid())
  branchId  String   @unique
  facts     Json     // key facts true in this branch
  eventLog  Json     @default("[]") // ordered array of BranchEvent
  updatedAt DateTime @updatedAt

  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
}
```

## Sharing & Provenance

```prisma
model SharedAssetProvenance {
  id                  String   @id @default(cuid())
  originalCreatorId   String
  originalAssetId     String
  originalAssetType   String   // "CharacterTemplate" | "WorldTemplate" | etc
  attributionRequired Boolean  @default(true)
  remixAllowed        Boolean  @default(false)
  createdAt           DateTime @default(now())

  characterTemplates  CharacterTemplate[]
  worldTemplates      WorldTemplate[]
  artStylePresets     ArtStylePreset[]
  storyPromptSeeds    StoryPromptSeed[]
}

model ImportedAsset {
  id           String   @id @default(cuid())
  userId       String
  assetType    String
  assetId      String   // the local copy's ID
  provenanceId String
  importedAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([assetType, assetId])
}
```

## Generation & Images

```prisma
model GenerationRun {
  id                 String    @id @default(cuid())
  userId             String
  storyId            String?   @unique
  status             RunStatus @default(PENDING)
  requestPayload     Json
  normalizedRequest  Json?
  contextPack        Json?
  promptVersions     Json?
  providerLog        Json      @default("[]") // ProviderLogEntry[]
  validationReports  Json      @default("[]") // ValidationReport[]
  repairInstructions Json      @default("[]")
  tokenUsage         Json?     // TokenUsage per provider
  costEstimateUsd    Float?
  latencyMs          Int?
  errors             Json      @default("[]")
  finalOutput        Json?
  createdAt          DateTime  @default(now())
  completedAt        DateTime?

  user  User   @relation(fields: [userId], references: [id])
  story Story? @relation(fields: [storyId], references: [id])

  @@index([userId])
  @@index([status])
}

model SceneSpec {
  id          String   @id @default(cuid())
  storyId     String
  order       Int
  description String
  characters  String[]
  setting     String
  mood        String
  lighting    String?
  imagePrompt String?
  createdAt   DateTime @default(now())

  story      Story       @relation(fields: [storyId], references: [id], onDelete: Cascade)
  imageAsset ImageAsset?

  @@index([storyId])
}

model ImageAsset {
  id             String   @id @default(cuid())
  storyId        String?
  sceneSpecId    String?  @unique
  storageKey     String
  url            String
  prompt         String
  negativePrompt String?
  provider       String
  model          String
  width          Int?
  height         Int?
  metadata       Json
  createdAt      DateTime @default(now())

  story     Story?     @relation(fields: [storyId], references: [id])
  sceneSpec SceneSpec? @relation(fields: [sceneSpecId], references: [id])

  @@index([storyId])
}
```

## Reusable Creative Assets

```prisma
model ArtStylePreset {
  id             String      @id @default(cuid())
  userId         String
  name           String
  description    String?
  styleKeywords  String[]
  medium         String?     // "watercolor", "storybook", "pencil sketch"
  colorPalette   String?
  negativeTerms  String[]
  sharePolicy    SharePolicy @default(PRIVATE)
  provenanceId   String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  user       User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  provenance SharedAssetProvenance? @relation(fields: [provenanceId], references: [id])

  @@index([userId])
  @@index([sharePolicy])
}

model StoryPromptSeed {
  id          String      @id @default(cuid())
  userId      String
  name        String
  prompt      String
  themes      String[]
  suggestedModes StoryMode[]
  sharePolicy SharePolicy @default(PRIVATE)
  provenanceId String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  user       User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  provenance SharedAssetProvenance? @relation(fields: [provenanceId], references: [id])

  @@index([userId])
  @@index([sharePolicy])
}
```

## Indexes & Performance Notes

- All FK columns are indexed
- `SharePolicy` indexed on shareable entities for public discovery queries
- `GenerationRun.status` indexed for worker polling
- `Story.content` stored as JSON (PostgreSQL JSONB) for flexible page structure
- Large JSON audit fields (providerLog, validationReports) stored as JSONB arrays, queryable via Prisma's JSON filter API
