# Interactive Travel Journal

A personal **travel-journal world map**: keep location pins for trips you've taken, attach journal entries (notes, restaurants, etc.), and explore them on a clean flat 2D world map. The product vision is one loop: **Plan → Go → Remember.**

> This README doubles as the project's context/handoff doc — read it first when continuing work. Last updated: 2026-06-23.

## Tech stack

- **Next.js 16.2.6** (App Router) + **React 19**. ⚠️ Non-standard Next build — per `AGENTS.md`, consult `node_modules/next/dist/docs/` before using Next APIs; conventions may differ from training data.
- **d3-geo** for the 2D SVG map projection/paths.
- **Supabase** (`@supabase/supabase-js`) for auth (email/password) + Postgres data.
- Vanilla CSS (CSS variables), font **Inter**. Neutral grayscale palette with a single coral accent (`#E2603F`).

## Getting started

Prerequisites: Node.js 18+ and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

Create `.env.local` (gitignored) with your Supabase project values:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Architecture / key files

- **`src/components/MapCanvas.jsx`** — app shell. All React state, Supabase auth + pin loading, every handler, and the UI overlay: top-center nav, the full-height right-side **Travel Journals panel**, bottom-left profile bubble + menu, bottom-right ADD ENTRY. Renders `<WorldMap/>`.
- **`src/components/WorldMap.jsx`** — the flat 2D map (D3-geo SVG). Pure presentation + interaction; talks to the shell via callbacks. Props: `geoJson, statesGeoJson, pins, activePinId, showPaths, flyTo, onPinClick, onMapClick, onHoverRegion, onClusterClick`.
- **`src/app/globals.css`** — theme tokens in `:root` + component classes.
- **`src/lib/supabase/client.js`** — Supabase client.
- **`src/app/page.js`** — dynamic-imports MapCanvas with SSR disabled (needs DOM).
- **`public/data/countries.json`**, **`public/data/us-states.json`** — GeoJSON.
- **`src/app/api/pins/route.js`** — legacy local-JSON fallback; effectively unused (data lives in Supabase).

### WorldMap internals
- `geoNaturalEarth1()` projection, `fitExtent` to the measured container (ResizeObserver), `geoPath`.
- `rewindGeo()` — fixes backwards-wound GeoJSON polygons (d3-geo reads an inverted ring as covering the whole sphere; Bermuda was doing this and painting over everything).
- Pan (pointer drag) + wheel zoom; `MIN_K=1`, `MAX_K=32`. `movedRef` distinguishes a drag from a click.
- `animateTo()` — rAF tween for fly-to / cluster-zoom. Fly-to goes to `MAX_K`, centered in the area left of the panel.
- Proximity **clustering** (`CLUSTER_PX=30`) → coral count bubbles.
- **Choropleth**: countries fill coral by pin count (`PIN_FILLS` ramp, 1 → faint … 5+ → full accent); unvisited stay gray.
- Country **borders** fade in with zoom (`borderAlpha`); US state subdivisions fade in past a zoom threshold.
- Sphere outline rendered *inside* the zoom/pan transform so it scales with the map.
- Hover sets the "Exploring Region" badge: country name, a single pin's `location_name`, or a cluster's first (earliest) location.

## Data model (Supabase)

- **`pins`**: `id` (uuid), `user_id`, `title`, `location_name`, `latitude`, `longitude`, `start_date`, `end_date`, `trip_type`, `created_at`, `updated_at`.
- **`pin_logs`**: `id`, `pin_id` (FK, ON DELETE CASCADE), `log_date`, `title`, `content`, `category` (Experience / Restaurant / Lodging / Transit), `media_urls` (array — UI not built yet), `created_at`.
- **RLS**: users CRUD only their own rows.
- Convention: `location_name` = "Place, Country"; `title` = the trip/activity (e.g. "Euro Enduro Snowboarding").

## Behaviors

- **Click pin** → fly to max zoom + open that pin's detail in the panel.
- **Click cluster** → zoom-to-fit the group + list its locations in the panel ("N Locations", with "All journals" back).
- **Click map (land or ocean) while panel open** → dismiss panel; nav slides back to Interactive Map.
- **Click land while panel closed** → open Add Memory form at those coords (editable lat/lon inputs).
- The panel is one unified surface: full journal list ↔ cluster list ↔ pin detail (full edit pin + add/edit/delete logs + remove pin) ↔ add form.
- Nav: **Interactive Map** and **Travel Journals** are wired; **Memory Gallery** and **AI Trip Planner** are placeholders.

## Roadmap (next phases — not built yet)

The visual phase is done. Remaining, in order:

1. **Trips model + migration** — a `trips` table (title, date range, cover, stops); group pins into trips. The cluster-list UI previews how a trip's stops will read.
2. **Photos** — device upload **and** Google Photos via the **Picker API** (manual-pick; full-library read was removed by Google in 2025). Store copies in **Supabase Storage**. Build the **Memory Gallery** (filterable; click photo → fly-to + open trip).
3. **Google sign-in** ("Continue with Google"); the Photos Picker scope is a *separate* consent from app login.
4. **AI Trip Planner** — conversational future-trip planning → drafts a Trip with stops dropped on the map (Claude API).

## Development notes

- **Git**: work on `main`; commit and push together. Commit messages end with the Co-Authored-By Claude line.
- **Browser verification**: an automated/hidden tab pauses `requestAnimationFrame`, so map **animations freeze** during headless checks and the SVG may need a second paint. React/SVG DOM (panels, lists, badges) renders fine regardless.
- **Bulk data edits** can be run against Supabase PostgREST from an authenticated browser session (read the user's JWT from `localStorage`, send `apikey` + `Authorization: Bearer <jwt>`) — respects RLS without a service key.
- **Any new map GeoJSON** must pass through `rewindGeo` or inverted polygons will paint over the map.

## History (newest last)

1. Reviewed codebase; archived to GitHub.
2. Fixed "DEC 1969" date bug (guard null dates → "Undated"; undated sorts last).
3. Added full pin + log editing (Supabase update/delete).
4. **Unified UI**: removed the floating pin card; everything in the right panel; clicking a pin opens its detail; single `activePin` source of truth.
5. Profile bubble → bottom-left (menu above it); panel full-height; click-map-to-dismiss.
6. **Design alignment**: flat 2D map, neutral grayscale + coral accent, Trips/photos/AI roadmap.
7. **Visual overhaul**: removed Three.js + ocean caustics; built `WorldMap.jsx` (d3-geo); Inter font.
8. Fixed Bermuda inverted-winding; sphere outline scales with map.
9. **Grayscale palette** + **pin-count choropleth**; country borders reveal on zoom.
10. Readable profile-menu buttons; **cluster → locations list**; cluster also **zooms to fit**; `MAX_K` raised to 32; **editable lat/lon** in Add form.
11. Pin click always flies to **max zoom**.
12. Populated the European trip ("Euro Enduro Snowboarding", Feb 2026): 12 dated stops + restaurant logs, accurate resort coordinates.
13. Hover badge shows pin/cluster location.
