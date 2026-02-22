# Albums & AI-Suggested Albums - Implementation Tasks

## Document Info

**Created:** February 2025  
**Status:** Ready for implementation  
**Related:** requirements.md, design.md  
**Timeline:** TBD (estimate 6–10 weeks depending on AI pipeline choice)

---

## Task Overview

### Phase Summary

| Phase | Focus | Status |
|-------|--------|--------|
| Phase 1: Core album data and API | Backend models, migrations, CRUD API | Not Started |
| Phase 2: Album UI | List, create, edit, delete, photo picker | Not Started |
| Phase 3: AI suggestion pipeline | Theme detection, suggested_albums, APIs | Not Started |
| Phase 4: Suggestion UI | Request suggestions, accept/edit/dismiss | Not Started |
| Phase 5: Export for print | Export job, format (PDF/ZIP), download | Not Started |

---

## Phase 1: Core Album Data and API

**Dependencies:** Photo management system (photos queryable by user), auth in place.

### Task 1.1: Album and album_photos data models and migrations

**Type:** Backend  
**Priority:** P0  
**Status:** Not Started

**Description:**  
Add `albums` and `album_photos` tables and migrations; enforce user ownership and unique (album_id, photo_id).

**Subtasks:**
- [ ] Define `albums` table (id, user_id, title, description, cover_photo_id, created_at, updated_at) **[BACKEND]**
- [ ] Define `album_photos` table (id, album_id, photo_id, position, caption, created_at) **[BACKEND]**
- [ ] Add FK to users and photos; unique (album_id, photo_id); index (user_id, album_id) **[BACKEND]**
- [ ] Create and run migrations **_Requirements: design.md Data Models_**

---

### Task 1.2: Albums CRUD API

**Type:** Backend  
**Priority:** P0  
**Status:** Not Started

**Description:**  
Implement album list, create, get, update, delete and album-photos add/update/remove/reorder.

**Subtasks:**
- [ ] GET /api/albums — list albums for current user with cover + photo count **[BACKEND]**
- [ ] POST /api/albums — create album (title, description, optional photo_ids) **[BACKEND]**
- [ ] GET /api/albums/:id — album detail + ordered photo list (thumbnails, captions); 404 if not owner **[BACKEND]**
- [ ] PATCH /api/albums/:id — update title, description, cover; 404 if not owner **[BACKEND]**
- [ ] DELETE /api/albums/:id — delete album and album_photos only; 404 if not owner **[BACKEND]**
- [ ] POST /api/albums/:id/photos — add photos (photo_ids, optional positions/captions); validate photo ownership **[BACKEND]**
- [ ] PATCH /api/albums/:id/photos — reorder, update captions, remove photos **[BACKEND]**
- [ ] Add integration tests for all endpoints **_Requirements: Req 1, Req 5_**

---

## Phase 2: Album UI

**Dependencies:** Phase 1 complete; photo library/list API available in frontend.

### Task 2.1: Album list and empty state

**Type:** Frontend  
**Priority:** P0  
**Status:** Not Started

**Description:**  
Album list view with cover, title, count; empty state with “Create album” and “Get AI suggestions”.

**Subtasks:**
- [ ] Add route/page for “Albums” **[FRONTEND]**
- [ ] Implement AlbumList component (grid or list, cover image, title, photo count) **[FRONTEND]**
- [ ] Wire to GET /api/albums **[FRONTEND]**
- [ ] Empty state: “Create album” and “Get AI suggestions” CTAs **_Requirements: Req 1 (list, empty state), Req 6_**

---

### Task 2.2: Create and edit album flow

**Type:** Frontend  
**Priority:** P0  
**Status:** Not Started

**Description:**  
Create/edit album form (title, description) and photo picker from user’s library; save and redirect to album detail.

**Subtasks:**
- [ ] CreateOrEditAlbum form (title, description) **[FRONTEND]**
- [ ] Photo picker: load user photos (reuse photo list from photo management), multi-select, optional search/filter **[FRONTEND]**
- [ ] On save: POST or PATCH album, then POST/PATCH album photos (positions); handle errors **[FRONTEND]**
- [ ] After create/update, navigate to album detail **_Requirements: Req 1 (create, edit)_**

---

### Task 2.3: Album detail and in-album editing

**Type:** Frontend  
**Priority:** P0  
**Status:** Not Started

**Description:**  
Album detail view with ordered photo grid; edit mode for add/remove/reorder/captions.

**Subtasks:**
- [ ] AlbumDetail page: title, description, ordered photo grid (thumbnails, optional captions) **[FRONTEND]**
- [ ] Edit mode: add photos (picker), remove, reorder (drag or up/down), edit captions **[FRONTEND]**
- [ ] Save changes via PATCH album and PATCH album photos **[FRONTEND]**
- [ ] Delete album with confirmation; redirect to list **_Requirements: Req 1 (view, edit, delete)_**

---

## Phase 3: AI Suggestion Pipeline

**Dependencies:** Phase 1 complete; access to user photos (IDs, metadata, optionally thumbnails/assets for vision).

### Task 3.1: Suggested album storage and API

**Type:** Backend  
**Priority:** P1  
**Status:** Not Started

**Description:**  
Persist suggested albums and expose list/accept/dismiss APIs.

**Subtasks:**
- [ ] Add `suggested_albums` table (id, user_id, theme_type, title, description, photo_ids JSONB, metadata JSONB, status, created_at) **[BACKEND]**
- [ ] GET /api/albums/suggestions — list suggestions for user (e.g. status = pending) **[BACKEND]**
- [ ] POST /api/albums/suggestions/:id/accept — create album from suggestion (optional overrides); set status accepted **[BACKEND]**
- [ ] POST /api/albums/suggestions/:id/dismiss — set status dismissed **[BACKEND]**
- [ ] Validate all photo_ids belong to user on accept **_Requirements: Req 2 (accept, dismiss, partial accept)_**

---

### Task 3.2: Theme detection and suggestion generation

**Type:** Backend  
**Priority:** P1  
**Status:** Not Started

**Description:**  
Implement or integrate theme detection (baby, family, events, holidays, time-evolution); write results to `suggested_albums`.

**Subtasks:**
- [ ] Define theme types (baby, family, events, holidays, time_evolution) and config (max photos per run, limits) **[BACKEND]**
- [ ] Implement or integrate AI/vision step: input user photo set, output clusters with theme labels **[BACKEND]**
- [ ] Map clusters to suggested_albums rows (title, description, photo_ids, metadata for time ordering) **[BACKEND]**
- [ ] POST /api/albums/suggestions — trigger generation (sync or async job); return suggestion list or job_id **[BACKEND]**
- [ ] Handle “too few photos” / “no themes” with clear response **_Requirements: Req 2, Req 3_**

---

### Task 3.3: Time-evolution ordering and metadata

**Type:** Backend  
**Priority:** P2  
**Status:** Not Started

**Description:**  
For time_evolution suggestions, set ordering (e.g. by date) and store in metadata; accept API applies order to album_photos.

**Subtasks:**
- [ ] When creating time_evolution suggestions, attach date ordering (from photo metadata) **[BACKEND]**
- [ ] On accept, create album_photos with position by date (oldest first or user preference if exposed) **[BACKEND]**
- [ ] Expose ordering in suggestion payload for UI **_Requirements: Req 3_**

---

## Phase 4: Suggestion UI

**Dependencies:** Phase 2 and 3.1 complete; 3.2 at least returns mock or real suggestions.

### Task 4.1: Request and display suggestions

**Type:** Frontend  
**Priority:** P1  
**Status:** Not Started

**Description:**  
“Get AI suggestions” flow: trigger generation, show loading, then list suggestion cards.

**Subtasks:**
- [ ] From empty state or album list, “Get AI suggestions” calls POST /api/albums/suggestions **[FRONTEND]**
- [ ] Show loading/placeholder while generating **[FRONTEND]**
- [ ] SuggestedAlbums component: cards with theme, title, preview thumbnails, photo count **[FRONTEND]**
- [ ] Wire to GET /api/albums/suggestions if needed for refresh **_Requirements: Req 2 (preview), Req 6_**

---

### Task 4.2: Accept, edit, and dismiss suggestions

**Type:** Frontend  
**Priority:** P1  
**Status:** Not Started

**Description:**  
Accept (optionally after editing photo set/title), or dismiss; create album on accept.

**Subtasks:**
- [ ] AcceptSuggestionModal or inline: confirm title/description, show photo set; allow remove (subset) before accept **[FRONTEND]**
- [ ] On accept: POST .../accept with optional overrides; then navigate to new album **[FRONTEND]**
- [ ] Dismiss: POST .../dismiss; remove card from list **[FRONTEND]**
- [ ] Success/error messaging (non-technical) **_Requirements: Req 2 (accept, dismiss, partial accept), Req 6_**

---

## Phase 5: Export for Print

**Dependencies:** Phase 1 and 2 complete; S3 and job queue (e.g. Redis) available.

### Task 5.1: Export job model and API

**Type:** Backend  
**Priority:** P1  
**Status:** Not Started

**Description:**  
Persist export jobs; endpoint to create job and to poll/download result.

**Subtasks:**
- [ ] Add `album_export_jobs` table (id, user_id, album_id, format, status, result_file_key, expires_at, created_at, completed_at, error_message) **[BACKEND]**
- [ ] POST /api/albums/:id/export — create job (format: e.g. pdf or zip); return job_id **[BACKEND]**
- [ ] GET /api/albums/exports/:job_id — status + download URL when completed; 404/403 if not owner **[BACKEND]**
- [ ] Enforce album ownership and export limits (max size, rate limit) **_Requirements: Req 4, Req 5_**

---

### Task 5.2: Export worker (PDF or ZIP)

**Type:** Backend  
**Priority:** P1  
**Status:** Not Started

**Description:**  
Worker that builds print-ready output (PDF or ZIP of high-res images in order), uploads to S3, updates job.

**Subtasks:**
- [ ] Queue export jobs (e.g. Redis); worker picks up job **[BACKEND]**
- [ ] Load album and ordered photos; resolve best asset per photo (tier resolution) **[BACKEND]**
- [ ] Generate PDF (e.g. one photo per page) or ZIP of images in order **[BACKEND]**
- [ ] Upload to S3; set result_file_key and expires_at; set status completed or failed **[BACKEND]**
- [ ] Presigned download URL in GET export response **_Requirements: Req 4_**

---

### Task 5.3: Export UI

**Type:** Frontend  
**Priority:** P1  
**Status:** Not Started

**Description:**  
“Export for print” from album detail; format choice, trigger job, show progress and download link.

**Subtasks:**
- [ ] ExportForPrint component: format choice (e.g. “Download for printing” → PDF or ZIP) **[FRONTEND]**
- [ ] POST /api/albums/:id/export; show “Preparing…” and poll GET export until completed or failed **[FRONTEND]**
- [ ] On completion: show download link; optional “Order prints” / “Share” next steps **[FRONTEND]**
- [ ] Handle errors with clear, actionable messages **_Requirements: Req 4, Req 6_**

---

## Optional / Follow-up

- **Credit or tier gating:** If exports or AI suggestions consume credits or are tier-gated, add checks in Phase 3 and 5 and surface in UI.
- **Notifications:** When export is ready (async), notify user (in-app and/or email) if notification system exists.
- **Print partner integration:** Out of scope for initial release; can be a later phase.

---

## Summary

- **Phase 1–2:** Core albums (backend + UI) so users can create and manage albums manually.
- **Phase 3–4:** AI-suggested albums (pipeline + UI) to reduce manual browsing.
- **Phase 5:** Export for print so users can download a print-ready album.

Implement in order; Phase 4 can start with mock suggestions once 3.1 is done, then connect to real pipeline when 3.2 is ready.
