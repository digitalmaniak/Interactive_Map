# Project Context & Handoff

> Living context doc for continuing work in a fresh chat. Read this first.
> Last updated: 2026-06-23.

## What this is

A personal **travel-journal world map**. The user drops/keeps location pins for trips they've taken, attaches journal log entries (notes, restaurants, etc.), and explores them on a clean flat 2D world map. Auth + data via Supabase. The product vision is one loop: **Plan → Go → Remember.**

## Tech stack

- **Next.js 16.2.6** (App Router) + **React 19**. ⚠️ This is a non-standard Next build — per `AGENTS.md`, consult `node_modules/next/dist/docs/` before using Next APIs; conventions may differ from training data.
- **d3-geo** for the 2D SVG map projection/paths. (Three.js was removed — see history.)
- **Supabase** (`@supabase/supabase-js`) for auth (email/password) + Postgres data.
- Plain CSS (CSS variables) — no Tailwind. Font: **Inter**.

## Architecture / key files

- **`src/components/MapCanvas.jsx`** — the app shell. Holds all React state, Supabase auth + pin loading, every handler, and the entire UI overlay: top-center nav, the full-height right-side **Travel Journals panel**, bottom-left profile bubble + menu, bottom-right ADD ENTRY. Renders `<WorldMap/>` for the map itself.
- **`src/components/WorldMap.jsx`** — the flat 2D map (D3-geo SVG). Pure presentation + interaction; talks to the shell via callbacks. Props: `geoJson, statesGeoJson, pins, activePinId, showPaths, flyTo, onPinClick, onMapClick, onHoverRegion, onClusterClick`.
- **`src/app/globals.css`** — theme tokens in `:root` + component classes (see Design).
- **`src/lib/supabase/client.js`** — Supabase client (reads `NEXT_PUBLIC_*` env).
- **`src/app/page.js`** — dynamic-imports MapCanvas with SSR disabled (needs DOM).
- **`public/data/countries.json`**, **`public/data/us-states.json`** — GeoJSON.
- **`src/app/api/pins/route.js`** — legacy local-JSON fallback; effectively unused now (data lives in Supabase).
- **`.env.local`** — `NEXT_PUBLIC_SUPABASE_URL` + a publishable anon key. Supabase project ref: `hmpwdgwoohpwhhzbhboz`.

### WorldMap internals
- `geoNaturalEarth1()` projection, `fitExtent` to the measured container (ResizeObserver), `geoPath`.
- `rewindGeo()` — fixes backwards-wound GeoJSON polygons (d3-geo reads an inverted ring as covering the whole sphere; Bermuda was doing this).
- Pan (pointer drag) + wheel zoom; `MIN_K=1`, `MAX_K=32`. `movedRef` distinguishes a drag from a click.
- `animateTo()` — rAF tween for fly-to/cluster-zoom. Fly-to goes to `MAX_K`, centered in the area left of the panel.
- Proximity **clustering** (`CLUSTER_PX=30`) → coral count bubbles.
- **Choropleth**: countries fill coral by pin count (`PIN_FILLS` ramp, 1→faint … 5+→full accent); unvisited stay gray.
- Country **borders** fade in with zoom (`borderAlpha`); US state subdivisions fade in past a zoom threshold.
- Sphere outline is rendered *inside* the zoom/pan transform so it scales with the map.
- Hover sets the "Exploring Region" badge: country name, or a single pin's `location_name`, or a cluster's first (earliest) location.

## Data model (Supabase)

- **`pins`**: `id` (uuid), `user_id`, `title`, `location_name`, `latitude`, `longitude`, `start_date`, `end_date`, `trip_type`, `created_at`, `updated_at`.
- **`pin_logs`**: `id`, `pin_id` (FK, ON DELETE CASCADE), `log_date`, `title`, `content`, `category` (Experience / Restaurant / Lodging / Transit), `media_urls` (array — UI not built yet), `created_at`.
- **RLS**: users CRUD only their own rows (insert/update/delete all confirmed working).
- Convention: `location_name` = "Place, Country"; `title` = the trip/activity (e.g. "Euro Enduro Snowboarding").

## Behaviors (current)

- **Click pin** → fly to max zoom + open that pin's detail in the panel.
- **Click cluster** → zoom-to-fit the group + list its locations in the panel ("N Locations", with "All journals" back).
- **Click map (land or ocean) while panel open** → dismiss panel, nav slides back to Interactive Map.
- **Click land while panel closed** → open Add Memory form at those coords (coords are editable inputs).
- Panel is one unified surface: full journal list ↔ cluster list ↔ pin detail (with full **edit pin** + **edit/add/delete logs** + remove pin) ↔ add form.
- Nav: only **Interactive Map** and **Travel Journals** are wired. **Memory Gallery** and **AI Trip Planner** are placeholders (no handlers yet).

## What's been done (history, newest last)

1. Reviewed codebase; archived to GitHub (`digitalmaniak/Interactive_Map`).
2. Fixed "DEC 1969" date bug (guard null dates → "Undated"; undated sorts last).
3. Added full pin + log editing (Supabase update/delete).
4. **Unified UI**: removed the floating pin card; everything lives in the right panel; clicking a pin opens its detail; dropped `selectedJournalPin` (single `activePin` source of truth).
5. Moved profile bubble to bottom-left (menu pops above it); panel spans full height; click-map-to-dismiss.
6. **Design alignment** (see memory `design-direction.md`): flat 2D map, neutral grayscale + single coral accent, Trips model, photos, AI planner.
7. **Phase 1 visual overhaul**: removed Three.js + ocean caustics; built `WorldMap.jsx` with d3-geo; Inter font; soft shadows.
8. Fixed Bermuda inverted-winding bug (rewind).
9. Sphere outline scales with map; **grayscale palette** + **pin-count choropleth**; country borders reveal on zoom.
10. Readable profile-menu buttons; **cluster → locations list** in panel.
11. Cluster click also **zooms to fit**; `MAX_K` raised to 32; **editable lat/lon** in Add form.
12. Pin click always flies to **max zoom** (no more zoom-out).
13. **Populated the European trip** ("Euro Enduro Snowboarding", Feb 2026): replaced 6 placeholder pins with 12 dated stops (Chamonix×3, Courmayeur, Verbier, Zermatt, Saas-Grund, Saas-Fee, Andermatt, Malbun, Sölden, St. Anton) + restaurant log entries; then set accurate resort coordinates.
14. Hover badge now shows pin/cluster location instead of "Hover over map".

## Where this is going (next phases — NOT built yet)

Build order agreed; Phase 1 (visual) is done. Remaining:
1. **Trips model + migration** — introduce a `trips` table (title, date range, cover, stops). Group existing pins into trips; journal + map organize by trip. The cluster-list UI is a preview of how a trip's stops will read.
2. **Photos** — device upload **and** Google Photos via the **Picker API** (date-hinted; full-library read was removed by Google in 2025, so it's manual-pick). Store copies in **Supabase Storage**. Build the **Memory Gallery** (filterable wall; click photo → fly-to + open trip).
3. **Google sign-in** ("Continue with Google"); note the Photos Picker scope is a *separate* consent from app login.
4. **AI Trip Planner** — conversational future-trip planning → drafts a Trip with stops dropped on the map (Claude API).

## Conventions & gotchas

- **Git workflow**: work directly on `main`; **commit and push together** in one step. Auth uses the user's PAT placed temporarily in the remote URL, then reset the remote to the plain URL so the token isn't persisted. End commit messages with the Co-Authored-By Claude line.
- **Browser verification (Claude-in-Chrome)**: the automated tab runs *hidden* → `requestAnimationFrame` is paused, so map **animations freeze** during verification and the SVG sometimes needs a **second screenshot** to paint (deferred first paint). React/SVG DOM (panels, lists, badges) renders fine. Don't conclude an animation is broken from a screenshot alone.
- **Live data edits** were done by running `fetch` against Supabase PostgREST **in the authenticated browser tab** (`javascript_tool`): read the user's JWT from `localStorage['sb-hmpwdgwoohpwhhzbhboz-auth-token']`, send `apikey: <publishable key>` + `Authorization: Bearer <jwt>`. This respects RLS. No service key is available locally.
- **GeoJSON winding**: any new map data must be run through `rewindGeo` (already applied in WorldMap) or inverted polygons will paint over everything.
- The local dev server runs via `npm run dev` (port 3000). Project memory lives under the Claude projects memory dir (`MEMORY.md` index + `design-direction.md`, etc.).
