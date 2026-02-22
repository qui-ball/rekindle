# Albums & AI-Suggested Albums - Design Document

## Overview

The Albums feature lets users create and manage photo collections and consume AI-generated album suggestions (themed and time-evolution). It reduces the effort of manually browsing the full library and supports export for print. The design aligns with the product’s emotional-first, mobile-friendly approach and integrates with the existing photo management and auth stack.

**Related Documents:**
- `requirements.md` - User stories and acceptance criteria
- `.kiro/steering/technical-architecture.md` - RunPod, S3, PostgreSQL, Redis
- `.kiro/specs/photo-management-system/design.md` - Photo entities and APIs

---

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ALBUMS FEATURE                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  📱 Mobile / 💻 Desktop                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ Album List │ Create/Edit Album │ AI Suggestions │ Accept/Edit │ Export     │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ALBUMS API LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Albums CRUD │ Suggested Albums (generate/list) │ Export (create/download)     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ PostgreSQL           │ │ AI / Vision Service  │ │ S3 + Export Jobs      │
│ albums, album_photos│ │ (theme detection)     │ │ (print-ready output)  │
│ suggested_albums    │ │ RunPod or external   │ │ Redis queue          │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

### Album and Suggestion Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Manual path                    │  AI suggestion path                           │
├─────────────────────────────────┼───────────────────────────────────────────────┤
│  1. Create album (title, desc)   │  1. Request "Suggest albums"                   │
│  2. Select photos from library  │  2. Backend analyzes user photos (vision +     │
│  3. Reorder / caption (opt)      │     metadata) → theme clusters                │
│  4. Save                        │  3. Return list of suggestions (theme,        │
│  5. Export when ready            │     photo set, time-evolution if applicable)  │
│                                  │  4. User accepts / edits / dismisses         │
│                                  │  5. Accept → create album from suggestion     │
│                                  │  6. Export when ready                         │
└─────────────────────────────────┴───────────────────────────────────────────────┘
```

### Export for Print Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  User selects "Export for print" on an album                                    │
│       → Backend creates export job (format: e.g. PDF or ZIP of images)          │
│       → Job runs (async if large): collect assets, build PDF/ZIP                │
│       → Store result in S3 (short-lived URL) or generate on-the-fly for small   │
│       → User gets download link / file                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Album

- **albums**
  - `id` (UUID, PK)
  - `user_id` (FK → users, required)
  - `title` (string, required)
  - `description` (text, optional)
  - `cover_photo_id` (FK → album_photos or photos, optional)
  - `created_at`, `updated_at`

### Album membership (order + optional caption)

- **album_photos**
  - `id` (UUID, PK)
  - `album_id` (FK → albums)
  - `photo_id` (FK → photos; user’s photo)
  - `position` (integer, for ordering)
  - `caption` (text, optional)
  - `created_at`

- Unique constraint: `(album_id, photo_id)` to avoid duplicates. Order by `position` when returning album contents.

### AI suggestions (persisted for “accept” / “dismiss”)

- **suggested_albums**
  - `id` (UUID, PK)
  - `user_id` (FK → users)
  - `theme_type` (enum: e.g. `baby`, `family`, `events`, `holidays`, `time_evolution`)
  - `title` (suggested title)
  - `description` (optional short blurb)
  - `photo_ids` (array of UUIDs or JSONB; references user’s photos)
  - `metadata` (JSONB: e.g. date range, confidence, person/theme hints for time-evolution)
  - `status` (e.g. `pending`, `accepted`, `dismissed`)
  - `created_at`

- When user accepts: create `albums` + `album_photos` from `suggested_albums`, then set `status = accepted` (and optionally link `album_id`). When dismissed: `status = dismissed`.

### Export jobs (async export for print)

- **album_export_jobs**
  - `id` (UUID, PK)
  - `user_id` (FK → users)
  - `album_id` (FK → albums)
  - `format` (e.g. `pdf`, `zip`)
  - `status` (`queued`, `processing`, `completed`, `failed`)
  - `result_file_key` (S3 key or null)
  - `expires_at` (for temporary download URL)
  - `created_at`, `completed_at`, `error_message` (optional)

---

## AI Theme Detection (Conceptual)

- **Input:** Set of user’s photos (IDs + metadata; optionally image bytes or thumbnails for vision).
- **Output:** One or more suggested albums, each with `theme_type`, `title`, `photo_ids`, optional `description` and `metadata` (e.g. date range, time-evolution flag).

**Theme types to support (per requirements):**

- Baby / child photos  
- Family photos  
- Events / parties  
- Holidays  
- Time-evolution (same person or theme over years)

**Implementation options (to be chosen in implementation phase):**

1. **Vision API (RunPod or other):** Analyze image content (scenes, faces, objects) and cluster into themes; use date metadata for time-evolution ordering.
2. **Metadata + heuristics:** Use existing metadata (dates, filenames, any existing tags) to cluster by time and simple rules; optional lightweight vision for “baby” vs “event” etc.
3. **Hybrid:** Metadata for ordering and filtering; vision for theme labels and grouping.

**Constraints:**

- Only analyze photos the user owns; respect storage and compute limits (e.g. max photos per suggestion run, tier-based limits).
- No persistent face identity required for MVP; time-evolution can be “same cluster” or “same estimated person” from a single run.

---

## API Surface (Summary)

- **Albums**
  - `GET /api/albums` — list user’s albums (with cover + count).
  - `POST /api/albums` — create album (title, description, optional initial photo_ids).
  - `GET /api/albums/:id` — album detail + ordered photo list (with thumbnails, captions).
  - `PATCH /api/albums/:id` — update title, description, cover, and/or photo set (replace or delta).
  - `DELETE /api/albums/:id` — delete album (not photos).
  - `POST /api/albums/:id/photos` — add photos (body: photo_ids, positions/captions).
  - `PATCH /api/albums/:id/photos` — reorder / update captions / remove photos.

- **Suggestions**
  - `POST /api/albums/suggestions` — trigger generation of suggested albums (may be async; return job_id or return suggestions when fast).
  - `GET /api/albums/suggestions` — list pending (and optionally recent accepted/dismissed) suggestions.
  - `POST /api/albums/suggestions/:id/accept` — create album from suggestion (optional body: overrides for title, photo subset).
  - `POST /api/albums/suggestions/:id/dismiss` — mark suggestion as dismissed.

- **Export**
  - `POST /api/albums/:id/export` — request export for print (body: format e.g. `pdf` or `zip`). Returns export_job_id.
  - `GET /api/albums/exports/:job_id` — status + result download URL when completed.
  - Optional: `GET /api/albums/:id/export` for synchronous small export (e.g. ZIP < N photos).

---

## Frontend Components (Conceptual)

- **AlbumList** — Grid or list of user albums (cover, title, count); empty state with “Create album” and “Get AI suggestions”.
- **AlbumDetail** — Title, description, ordered photo grid; edit (add/remove/reorder/caption), export CTA.
- **CreateOrEditAlbum** — Form (title, description) + photo picker (from library) + ordering/captions.
- **SuggestedAlbums** — List of suggestion cards (theme, title, preview thumbnails, count); actions: Accept, Edit then accept, Dismiss.
- **AcceptSuggestionModal** — Confirm title/description and photo set (add/remove) before creating album.
- **ExportForPrint** — Format choice (e.g. PDF / ZIP), trigger export job, then poll or follow link to download when ready.

All components should be responsive and touch-friendly; copy and errors should be non-technical and emotionally aligned.

---

## Export for Print (Technical Notes)

- **Formats:** At least one of: PDF (one photo per page or grid), or ZIP of high-resolution images in album order. Exact formats can be defined in implementation (tasks).
- **Asset choice:** Use best available processed result per photo (e.g. restored/colourized) within user tier (e.g. 720p paid, 480p free).
- **Rate and size limits:** Max album size for export, max concurrent exports per user, and retention of export files (e.g. 24–48 hour expiry) to control storage and abuse.
- **Async:** For large albums, use Redis-backed job queue; notify user when ready (in-app and/or email if available).

---

## Security and Privacy

- All album and suggestion APIs must be scoped to the authenticated user (`user_id` from session).
- Photo selection must enforce that every `photo_id` belongs to the same user (no cross-user album membership).
- Export must only include photos the user is allowed to access; generate signed URLs with short expiry for download.
- AI pipeline must only read the requesting user’s photos; no cross-user data in theme detection.

---

## Dependencies and Integration

- **Photo Management:** Depend on existing photo list and metadata APIs; album_photos reference the same `photos` table (or equivalent).
- **Auth:** Reuse existing Supabase (or current) auth; all endpoints require authenticated user.
- **Storage:** Thumbnails and full-size assets via existing S3/CDN; export output stored in S3 with lifecycle or manual cleanup.
- **Credits/Tier:** If export or “suggestions” consume credits or are gated by tier, apply same patterns as photo processing (see product-and-sales-strategy and technical-architecture).

This design provides a foundation for implementing albums, AI-suggested albums, and print export in line with the steering context and requirements.
