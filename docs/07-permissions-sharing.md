# Permissions & Selective Sharing Model

## Design Philosophy

- **Private by default.** Every entity is `SharePolicy.PRIVATE` unless explicitly changed.
- **Sharing is always on a specific entity**, never a bulk export.
- **What gets shared is the template, not the instance.** Character templates can be shared; character instances (with private continuity state) cannot be shared directly.
- **Import creates a local copy.** Importing a shared asset never gives the importer access to the original's future changes or private data.
- **Provenance is always preserved.** Imported copies carry a `provenanceId` linking back to the original creator and asset.
- **Attribution is opt-in but default on.** `SharedAssetProvenance.attributionRequired` defaults to `true`.

---

## SharePolicy Enum

```typescript
enum SharePolicy {
  PRIVATE        // Only owner can access. Not discoverable.
  UNLISTED       // Accessible via direct link/ID share. Not discoverable.
  PUBLIC_VIEW    // Discoverable in library. Read-only. Cannot import.
  PUBLIC_REUSE   // Discoverable. Can be imported into other libraries.
  PUBLIC_REMIX   // Discoverable. Can be imported AND forked/modified.
}
```

---

## Shareable Entity Types

| Entity | Can Be Shared | Notes |
|--------|--------------|-------|
| `CharacterTemplate` | Yes | Essence only. No instance state. |
| `WorldTemplate` | Yes | Rules and tone only. No instance state. |
| `ArtStylePreset` | Yes | Style spec and keywords. |
| `StoryPromptSeed` | Yes | Prompt text and themes. |
| `Story` | Yes, if explicitly set | Entire story content. User must opt-in. |
| `Series` | Metadata only, if set | Not full content. Allows discoverability. |
| `CharacterInstance` | No | Contains private continuity state. |
| `BranchMemory` | No | Private continuity history. |
| `WorldCanon` | No | Private lore accumulation. |
| `GenerationRun` | No | Private audit log. |

---

## Import Flow

When User B imports User A's `PUBLIC_REUSE` CharacterTemplate:

1. API validates: target entity has `sharePolicy >= PUBLIC_REUSE`
2. A **copy** of the CharacterTemplate is created in User B's library
3. `SharedAssetProvenance` record is created:
   - `originalCreatorId` = User A's ID
   - `originalAssetId` = original template ID
   - `originalAssetType` = "CharacterTemplate"
   - `attributionRequired` = (from original's policy)
   - `remixAllowed` = (true if REMIX policy)
4. Copied template's `provenanceId` = new provenance record ID
5. `ImportedAsset` record created for User B
6. User B now owns their copy — independent of original

**What is NOT imported:**
- Character instances
- Any continuity state
- Generation logs
- Private metadata

---

## Provenance Display

When a user views an asset with `provenanceId`, the UI shows:
> "Based on '[Character Name]' by @originalcreator"

If `attributionRequired = true`, this attribution is mandatory in UI rendering of the character (reader view, story pages, etc.)

---

## Access Control Rules

```typescript
// lib/services/access-control.ts

function canRead(userId: string, entity: SharableEntity): boolean {
  if (entity.userId === userId) return true
  return entity.sharePolicy !== "PRIVATE"
}

function canImport(userId: string, entity: SharableEntity): boolean {
  if (entity.userId === userId) return false // can't import own asset
  return ["PUBLIC_REUSE", "PUBLIC_REMIX"].includes(entity.sharePolicy)
}

function canRemix(userId: string, entity: SharableEntity): boolean {
  return entity.sharePolicy === "PUBLIC_REMIX"
}
```

---

## Discovery API

Public discovery is **not** a social feed. It is a filtered library query.

```
GET /api/library/characters?sharePolicy=PUBLIC_REUSE&tags=wizard,mentor&page=1
GET /api/library/worlds?sharePolicy=PUBLIC_REUSE
GET /api/library/art-styles
GET /api/library/prompt-seeds
```

No likes, comments, or follower counts at MVP. Just filtered browseable collections.

---

## What Happens When Policy Changes

If User A changes a template from `PUBLIC_REUSE` back to `PRIVATE`:
- Their own entity becomes non-discoverable
- **Already-imported copies in other users' libraries are not affected**
- Provenance records remain but no new imports are permitted

This is intentional — imports are explicit copies, not live subscriptions.

---

## Series-Level Sharing

A Series can optionally be marked `PUBLIC_VIEW` to allow other users to browse its story titles and read published stories (if those stories are also `PUBLIC_VIEW` or higher).

This is NOT the same as sharing continuity state. Story content can be visible; character memory and branch memory remain private.

---

## MVP Sharing Scope

MVP includes:
- SharePolicy on CharacterTemplate, WorldTemplate, ArtStylePreset, StoryPromptSeed, Story
- Import flow for PUBLIC_REUSE / PUBLIC_REMIX entities
- Provenance tracking
- Discovery API (simple filtered queries)
- Attribution display in UI

Deferred to V2:
- Remix/fork workflow with attribution chain
- Featured/curated public collections
- Usage analytics for creators ("12 people imported your character")
- Creator profiles
