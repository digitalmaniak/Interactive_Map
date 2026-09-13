# Harbor first slice — apply notes

Status: **applied to live `travel-map`** (2026-09-13). SQL also copied to this folder. Not mixed with MapCanvas.

## Applied result

| Object | Count |
|---|---|
| journeys | 23 (1 Imported, 1 Euro Enduro with 12 pins, rest 1:1 dated) |
| pins | 41, all with journey_id + geohash |
| pin_logs | 51 (kept) |
| journal_blocks | 51 markdown (no media_urls to map) |
| activities | 41 (Experience) |
| restaurants | 10 |
| profiles | 1 |

MapCanvas inserts without `journey_id` still work (Imported default trigger).


## What this does

1. `profiles` + signup trigger (`auth.users` → profile).
2. `journeys` (`private` | `unlisted`, `share_token`, `deleted_at`).
3. In-place `pins.journey_id` (nullable → backfill → NOT NULL). Table name stays `pins`.
4. `pins.deleted_at`, `pins.geohash` (precision 7 from existing `latitude`/`longitude`). Does **not** rename lat/lng columns.
5. MapCanvas-safe default: inserts without `journey_id` attach to that user’s `Imported` journey.
6. RLS: owner RW on non-deleted; unlisted SELECT via `x-share-token` header matching `journeys.share_token`. No public list.
7. `journal_blocks` + `activities` + `restaurants`. `pin_logs` **kept**.
   - Experience logs → `activities` + markdown blocks
   - Restaurant logs → `restaurants` + markdown blocks
   - Non-empty `media_urls` → `media_gallery` blocks

## Grouping heuristic

- Dated pins: same user + same title + overlapping/adjacent dates (gap ≤ 3 days) → one journey.
- Undated pins → per-user journey titled `Imported` (refile later).

## Auth dashboard (not in SQL)

Keep email/password on. Then:

1. Authentication → Providers → Email: enable **Magic link**.
2. Authentication → Providers → **Google**: enable; add client id/secret when you have them.
3. Redirect URLs: add the Vercel app origin + `http://localhost:3000/**`.

Do not paste secrets into the repo.

## Unlisted share (route later)

Client/read-only route should send header `x-share-token: <journeys.share_token>`. Storage comes after this slice.

## Not in this slice

- Rename `pins` → `places`
- MapCanvas / WorldMap changes
- Share HTTP route
- Storage bucket
- PostGIS
- Live apply to any project other than `travel-map`

## Cloud Agents / git

Cursor Cloud Agents are not on the current plan. This SQL is the source of truth until it can be committed to `digitalmaniak/Interactive_Map` under `supabase/migrations/`.
