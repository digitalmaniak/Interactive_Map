# DESIGN — Atlas Editorial

Status: **LOCKED** (2026-09-13) — Angel chose Atlas Editorial over Night Cartographer.

Product north star: personal travel journal + later social discovery. Visual north star: **calm, photo-led, map-honest** — closer to Polarsteps restraint than a SaaS dashboard.

Mood boards (generated): see `reference/design/` (Editorial mock + Night Cartographer rejected alternate for contrast).

---

## Principles

1. **Restraint** — Don’t glass everything. Map + photos carry emotion; chrome stays quiet.
2. **One primary action** — Share, Add place, Write — not a toolbar of equals.
3. **Spatial truth** — Map and journal stay in sync (drilled journey → map highlights those pins).
4. **Fast capture, rich later** — Log a place in seconds; photos/notes can follow.
5. **Quiet chrome** — Nav/panels feel like frames/paper, not a cockpit.
6. **Light-first** — Atlas Editorial is a light UI. Dark mode is a later optional theme, not the brand.

---

## Visual system (v1 tokens)

| Token | Direction |
|---|---|
| Background | Off-white / warm stone (`#FAFAF8`–`#F5F2EC`) |
| Surface | White cards, soft shadow or 1px stone border |
| Text | Near-black ink (`#1C1917`), secondary muted (`#78716C`) |
| Accent | Coral / terracotta (keep family of current `--accent`; refine, don’t neon) |
| Map | Cool stone ocean/land (`#E4E9EE` / `#D5D8DC`), restrained terracotta choropleth, coral pins |
| Type | Inter (or system) — editorial hierarchy, generous line-height on titles |
| Radius | 12–16px cards; pills for chips |
| Glass | **Rare** — login overlay only if needed; journals panel is solid/soft opaque |

Avoid: heavy blur glass on every panel, neon accents, dense admin tables, dark-by-default chrome.

---

## Layout targets

- **Map** remains the emotional center on desktop.
- **Journals** = photo-led journey cards (cover when we have Storage), not only text rows.
- **Share page** (`/share/[token]`) should already feel Editorial: light, read-only, calm — align AuthGate toward the same light language over time.
- Mobile: thumb-friendly primary CTA; don’t ship a second product.

`WorldMap.jsx` stays SVG/d3-geo. Visual polish is palette, pin style, panel chrome — not a Three.js revival.


## Map ocean texture (Angel, 2026-09-13)

Disconnected **plus-sign grid** in the ocean (not a continuous line grid).

- Motif: small `+` marks on a regular lattice (plus arms only — no full crosshatch lines)
- Blend: very low contrast vs Cool stone `--ocean` — readable on a second look
- Suggested: `rgba(40, 48, 58, 0.14–0.18)`; stroke ~0.8–0.9px; arm length ~5–6px; spacing ~32px at default fit
- Implementation: SVG `<pattern>` under the Sphere ocean fill in `WorldMap.jsx` (pans/zooms with the map)
- Must not fight land fills or pins; stay cool-family ink (no warm brown lattice)


---

## Inspo checklist (Angel: collect 5–10 screens)

Paste or file under `reference/design/inspo/` when ready. Prefer:

1. Polarsteps — trip map + timeline restraint
2. Polarsteps — journey / trip overview card
3. A photo-led journal card (any travel app)
4. Clean light auth / empty state
5. Map + side panel split that doesn’t fight the map
6. Unlisted share / read-only trip page
7. (Optional) stats strip / countries visited
8–10. Free picks that feel “clean + human”

Label each: `keep / adapt / ignore`.

---

## Feature priority (UX power, post-Auth MVP)

Canonical prioritized list: [FEATURES.md](./FEATURES.md). Summary below.

Auth is done (password + magic link + Google). Next leverage:

### P0 — polish what exists
1. **Share / Stop sharing** one-action UX (token + unlisted + copy; Stop = private)
2. **Atlas Editorial visual pass** on AuthGate, Journals panel, share page (light surfaces, quieter chrome)
3. **Map ↔ journey sync** — drill into journey → highlight/filter those pins on WorldMap

### P1 — make the journal feel alive
4. **Place photos** (Supabase Storage) — journal without photos stays thin
5. **Day timeline** inside a journey (chronological story, not only a pin list)
6. **Quick-add place** (title + map pin; details optional)
7. **Stats strip** — countries / places / days

### P2 — deepen the log
8. Activities & restaurants UI (tables already exist)
9. Journey cover + editorial summary
10. Search / filter places & tags

### Later
Explore/public profiles, Google Photos import, collab journeys, AI planner → real journeys, PDF/travel book, live GPS tracking.

---

## Implementation notes for Atlas

- Prefer CSS variables / existing global styles over a new design system package unless Angel asks.
- Incremental PRs: AuthGate + share page skin → Journals cards → map pin/choropleth tweak. Don’t rewrite MapCanvas for aesthetics alone.
- Keep Imported / soft-delete / share RLS behaviors unchanged while restyling.
- Smoke on prod after each visual PR; preserve Angel’s real trip data.

## Harbor

- Storage bucket when Place photos become P1.
- No design SQL.

---

## Decision log

| Date | Decision |
|---|---|
| 2026-09-13 | Locked **Atlas Editorial** (vs Night Cartographer, Daylight Paper, Precision Itinerary) |
| 2026-09-13 | Auth MVP complete; design polish can proceed without blocking features |
| 2026-09-13 | Locked map palette **Cool stone** (`--ocean #E4E9EE`, `--land #D5D8DC`) via mocks; blue+warm-beige ruled out |
| 2026-09-13 | Parked **Paper Whimsy** future spike — colorful map + sparse cartoon clouds; traditional usable chrome; ignore shore close-ups. See `reference/design/whimsy-paper/NOTES.md`. Cool stone stays live. |
| 2026-10-12 | **Cool stone superseded for v2** by the Anduril direction (see VISION.md and the v2 section below). Cool stone stays on prod until cutover. |
| 2026-10-12 | v2 main view is mock A (perspective globe), trip view is mock C. Mock B and the orthographic camera are dropped. |
| 2026-10-12 | Display font is Inter Display (not Space Grotesk), mono is JetBrains Mono. Decided by Odyssey. |


## Map palette — Cool stone (LOCKED 2026-09-13)

Angel rejected warm beige ocean and cool-blue + brown-land clash. Locked from screenshot mocks:

| Token | Value | Notes |
|---|---|---|
| `--ocean` | `#E4E9EE` | blue-gray wash (cool family) |
| `--land` | `#D5D8DC` | cool stone |
| `--land-hover` | `#C8CCD1` | slightly deeper cool gray |
| Share wash | same as `--ocean` | cards stay white/paper |

- **Out:** pale blue `#D4E6F5` / `#E8F1F8` next to warm beige land; Warm paper (A); Ink & paper (C) unless Angel revisits.
- Pins + terracotta choropleth unchanged.
- Mock source: Odyssey recolored prod screenshot (`palette-mocks/B-cool-stone.png`).


---

## v2 Anduril direction (Oct 12 2026)

Rebuild v2 direction. See [VISION.md](./VISION.md). ~~Mock B for the main map~~ (superseded Oct 12 2026: mock A, perspective 3D globe, is the main view). Mock C for the trip view. References in `reference/design/anduril/`. Atlas Editorial and Cool stone stay on prod until cutover.

| Token | Value |
|---|---|
| `--v2-land` | `#1F2022` to `#282A2D`, soft relief |
| `--v2-ocean` | `#2D3A42` |
| `--v2-ocean-hatch` | `#5CC8E4` hatch lines |
| Coastline | Crisp, thin |
| `--v2-route` | Glowing cyan arcs, traveling dot |
| Stop marker | Thin cyan light beam |
| `--v2-accent` | `#FF3311`, current stop only |
| Labels | Tiny spaced white sans. Monospace coordinates and dates. |
| Title | Huge, tightly kerned white geometric sans, bottom left |
| Corners | Small `+` crosshairs |
| Home | Thin white range rings |
| Chrome | ODYSSEY wordmark, Map, Journals, Add entry |
| Motion | Eased drone camera that settles gently. Arcs draw in. Instant cuts on reduced motion. |
| Tech | ~~Orthographic top-down camera~~ (superseded). React Three Fiber, perspective globe camera, HTML labels on top. See Tokens below. |


---

## Superseded notes (Oct 12 2026)

- Mock B (flat map) is dropped. Mock A (perspective 3D globe) is the main view.
- The orthographic top-down camera is dropped. One perspective camera serves both views.
- Opening a trip eases into mock C's tilted close view. Closing eases back out to the globe.
- Relief is pre-shaded (baked texture) for v2. Real elevation is optional later.
- VISION.md matches this direction: mock A main, mock C trip, perspective camera.

---

## Deliverable 1: Build tokens for Atlas

World scale: the globe radius is `R = 1` world unit. All world sizes below are in that unit. 1 world unit is about 6,371 km.

### Colors

| Token | Hex | Role |
|---|---|---|
| `bg` | `#07090B` | Space behind the globe. Near black, slight blue. |
| `land.low` | `#1F2022` | Land base, valleys, shadow side of relief. |
| `land.high` | `#282A2D` | Land highlights in the baked relief. |
| `land.ridge` | `#3A3D41` | Brightest relief ridge. Use sparingly in the bake. |
| `ocean` | `#2D3A42` | Ocean fill. Darkens to `#16202A` at the globe limb. |
| `ocean.hatch` | `#5CC8E4` | Diagonal hatch lines on water. Drawn at 14% opacity. |
| `coast` | `#8A9399` | Coastline stroke. 70% opacity. |
| `route` | `#5CC8E4` | Arcs, beams, stop dots, traveling dot. |
| `route.core` | `#CFF4FF` | Hot center of the traveling dot and beam base. |
| `accent` | `#FF3311` | Current stop only. Dot, beam and timeline tick. |
| `ring` | `#FFA620` | Home range rings (home accent). Opacity 0.60, 0.35 and 0.15, inner to outer. |
| `text` | `#FFFFFF` | Titles and labels. |
| `text.dim` | `#9AA3A8` | Coordinates, dates, inactive nav. |
| `text.mute` | `#5E666B` | Future timeline dates and disabled items. |
| `atmo` | `#5CC8E4` | Fresnel rim on the globe. 18% opacity. |
| `panel` | `#0E1215` at 72% | Stop card fill, with 12px backdrop blur. |
| `panel.stroke` | `#FFFFFF` at 14% | Stop card and button borders. |

Home accent `#FFA620`. Used for home base rings and future highlight accents. Never for stops.

### Line weights

Lines use screen-space pixels (Line2 `worldUnits: false`) unless noted. Width values are CSS px. Multiply by the capped DPR in `resolution`.

| Line | Screen px | World units (if worldUnits) | Opacity |
|---|---|---|---|
| Coastline | 1.0 | 0.0012 | 0.70 |
| Graticule (optional, globe only) | 0.5 | n/a | 0.06 |
| Hatch line | 1.0 | n/a (shader) | 0.14 |
| Flight arc | 1.5 | 0.0020 | 0.95 |
| Drive line | 1.25 | 0.0015 | 0.90 |
| Train line | 1.25 | 0.0015 | 0.90 |
| Boat line | 1.0 | 0.0012 | 0.80 |
| Walk line | 1.0 | 0.0010 | 0.70 |
| Stop beam | 1.0 core + 6 glow | 0.0012 | 1.0 core, 0.25 glow |
| Home ring | 0.75 | 0.0010 | 0.35 |
| Corner crosshair `+` | 1.0, 16px arms | HTML/SVG | 0.80 |

### Hatch spacing (ocean)

- Angle: 35 degrees from horizontal in screen space. This matches mocks A and C.
- Spacing: 6 CSS px on the globe view, 9 CSS px on the trip view. It is screen-space, so it stays crisp at any zoom.
- Line thickness: 1 px with a 0.75 px smoothstep edge.
- Fade: hatch opacity falls to 0 over the last 15% toward the limb, and over 2 km out from the coast it rises from 8% to 14%.
- Implementation: compute in the globe fragment shader from `gl_FragCoord.xy`, masked by the ocean channel of the land mask texture.

### Beams (stops)

- Shape: a vertical line on the surface normal. Core plus additive glow quad.
- Height: `0.06 R` on the globe view, `0.12 R` scaled to trip view (about 2.5 cm on a phone screen either way).
- Gradient: full opacity at the base. Fades to 0 at the top with `pow(1 - t, 1.6)`.
- Base dot: 6 px disc, `route.core` center, `route` ring. Current stop uses `accent` for beam and dot.
- Draw-in: beam grows from 0 to full height in 450 ms, `cubic-bezier(0.16, 1, 0.3, 1)`.

### Arcs (routes)

- Color `route`. Additive blending. `depthWrite: false`.
- Draw-in: animate a `progress` uniform from 0 to 1 over `600 + 0.04 * km` ms, capped at 1800 ms. Easing `cubic-bezier(0.65, 0, 0.35, 1)`.
- Traveling dot: 4 px core in `route.core` with a 10 px glow. Speed: one full loop every 4 s per leg. Pause at each end for 400 ms.
- Midpoint tick: a small 3 px dot at t = 0.5, as in mock A.
- Back-face: on the globe view, fade arc segments behind the limb to 0 using `dot(normal, viewDir)`.

### Glow

| Param | Desktop | Phone (high tier) | Phone (low tier) |
|---|---|---|---|
| Bloom on | yes | yes | no, fake glow quads only |
| Bloom `intensity` (strength) | 0.9 | 0.7 | n/a |
| Bloom `radius` | 0.55 | 0.45 | n/a |
| Bloom `luminanceThreshold` | 0.62 | 0.68 | n/a |
| Bloom `luminanceSmoothing` | 0.12 | 0.12 | n/a |
| `mipmapBlur` | true | true | n/a |

- Emissive: route materials use `emissiveIntensity` 1.6 (color multiplied above 1 so only routes cross the threshold). Accent uses 2.0. Land and ocean stay below 0.5 luminance and never bloom.
- Use `toneMapping: ACESFilmic`, exposure 1.0. Mark route materials `toneMapped: false` so the cyan stays saturated.
- Low tier fake glow: a camera-facing quad with a radial falloff texture, 24 px, additive, at every dot and the beam base.

### Type scale

Families:
- Display and UI sans: `Inter Display`, fallback `Inter`, `system-ui`. Geometric, tight. Locked by Odyssey. Mock C's title uses the same family.
- Mono: `JetBrains Mono`, fallback `IBM Plex Mono`, `ui-monospace`.

| Token | Size desktop / phone | Weight | Tracking | Family | Use |
|---|---|---|---|---|---|
| `title.hero` | 112 / 56 px, line 0.95 | 300 | -0.03em | sans | "Odyssey", "Portugal 2025" bottom left |
| `title.card` | 14 / 13 px | 500 | 0.24em, uppercase | sans | Stop card place name |
| `wordmark` | 13 / 12 px | 500 | 0.32em, uppercase | sans | ODYSSEY top left |
| `nav` | 13 / 13 px | 400 | 0.01em | sans | Map, Journals, Add entry |
| `label.place` | 11 / 10 px | 500 | 0.22em, uppercase | sans | Stop names on the map |
| `label.coord` | 10 / 9 px, line 1.4 | 400 | 0.02em | mono | Coordinates and dates under labels |
| `stats` | 12 / 10 px | 400 | 0.12em, uppercase | mono | "14 COUNTRIES 48,210 KM" |
| `timeline` | 11 / 10 px | 400 | 0.14em, uppercase | mono | Timeline dates |
| `body.card` | 13 / 13 px, line 1.5 | 400 | 0 | sans | Stop card note |

Minimum tap target on phones stays 44 px even when the label is 9 px.

### Camera: globe to trip and back

One `PerspectiveCamera`. The camera orbits the globe center. Distance is measured from the globe center. Tilt is the angle between the view ray and the surface normal at the target (0 is straight down).

| Key | t | FOV | Distance (R) | Tilt | Target |
|---|---|---|---|---|---|
| Globe rest | 0.0 | 35 deg | 3.2 | 0 deg (looking at center) | Globe center, framed on the user's trip region |
| Turn | 0.35 | 34 deg | 2.4 | 10 deg | Rotating toward trip bounding center |
| Descend | 0.7 | 30 deg | 1.35 | 32 deg | Trip bounding center on the surface |
| Trip rest (mock C) | 1.0 | 28 deg | fit to bounds, about 1.08 to 1.25 | 48 deg | Trip bounding center, offset 12% left so the card fits |

- Open: 1600 ms, `cubic-bezier(0.65, 0, 0.35, 1)` for position. FOV and tilt lag by 120 ms with `cubic-bezier(0.33, 1, 0.68, 1)`. That lag gives the drone settle.
- Close: 1200 ms, `cubic-bezier(0.32, 0, 0.15, 1)`. Keyframes run in reverse. Tilt reaches 0 by t = 0.6 of the close.
- Settle: after arrival, a 400 ms overshoot of 1.5% distance damped back to rest.
- Path: slerp the target on the sphere. Interpolate distance in log space so the descent feels even.
- Idle drift on the globe: 0.6 deg per second yaw, paused on touch, resumes 3 s after release.
- Arcs draw in starting at t = 0.75 of the open. Stop labels fade in over 250 ms after arrival.
- Reduced motion: instant cut to the end keyframe. No drift, no draw-in. Labels appear at once.

### Token block (TS)

```ts
// tokens.ts  ODYSSEY v2 (Anduril direction)
export const tokens = {
  world: { globeRadius: 1, kmPerUnit: 6371 },
  color: {
    bg: '#07090B',
    land: { low: '#1F2022', high: '#282A2D', ridge: '#3A3D41' },
    ocean: { fill: '#2D3A42', limb: '#16202A', hatch: '#5CC8E4', hatchOpacity: 0.14 },
    coast: '#8A9399', coastOpacity: 0.7,
    route: '#5CC8E4', routeCore: '#CFF4FF',
    accent: '#FF3311',
    ring: '#E6EDF0', ringOpacity: 0.35,
    text: '#FFFFFF', textDim: '#9AA3A8', textMute: '#5E666B',
    atmo: '#5CC8E4', atmoOpacity: 0.18,
    panel: 'rgba(14,18,21,0.72)', panelStroke: 'rgba(255,255,255,0.14)',
  },
  line: { // px = CSS px (screen space), wu = world units
    coast: { px: 1.0, wu: 0.0012 },
    graticule: { px: 0.5, opacity: 0.06 },
    fly: { px: 1.5, wu: 0.002 },
    drive: { px: 1.25, wu: 0.0015 },
    train: { px: 1.25, wu: 0.0015 },
    boat: { px: 1.0, wu: 0.0012 },
    walk: { px: 1.0, wu: 0.001 },
    beam: { corePx: 1, glowPx: 6 },
    ring: { px: 0.75 },
  },
  hatch: { angleDeg: 35, spacingPx: { globe: 6, trip: 9 }, thicknessPx: 1, aaPx: 0.75, limbFade: 0.15 },
  beam: { heightR: { globe: 0.06, trip: 0.12 }, falloffPow: 1.6, growMs: 450, growEase: [0.16, 1, 0.3, 1] },
  arc: {
    drawMs: (km: number) => Math.min(600 + 0.04 * km, 1800),
    drawEase: [0.65, 0, 0.35, 1],
    dot: { corePx: 4, glowPx: 10, loopMs: 4000, endPauseMs: 400 },
  },
  glow: {
    desktop: { enabled: true, intensity: 0.9, radius: 0.55, threshold: 0.62, smoothing: 0.12 },
    phoneHigh: { enabled: true, intensity: 0.7, radius: 0.45, threshold: 0.68, smoothing: 0.12 },
    phoneLow: { enabled: false, fakeGlowPx: 24 },
    emissive: { route: 1.6, accent: 2.0, maxSceneLuma: 0.5 },
  },
  type: {
    family: { sans: '"Inter Display", Inter, system-ui, sans-serif', mono: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace' },
    heroTitle: { size: [112, 56], weight: 300, tracking: '-0.03em', lineHeight: 0.95 },
    cardTitle: { size: [14, 13], weight: 500, tracking: '0.24em', upper: true },
    wordmark: { size: [13, 12], weight: 500, tracking: '0.32em', upper: true },
    nav: { size: [13, 13], weight: 400, tracking: '0.01em' },
    placeLabel: { size: [11, 10], weight: 500, tracking: '0.22em', upper: true },
    coord: { size: [10, 9], weight: 400, tracking: '0.02em', mono: true, lineHeight: 1.4 },
    stats: { size: [12, 10], weight: 400, tracking: '0.12em', mono: true, upper: true },
    timeline: { size: [11, 10], weight: 400, tracking: '0.14em', mono: true, upper: true },
    body: { size: [13, 13], weight: 400, tracking: '0', lineHeight: 1.5 },
  },
  camera: {
    keyframes: [
      { t: 0.0, fov: 35, distR: 3.2, tiltDeg: 0 },
      { t: 0.35, fov: 34, distR: 2.4, tiltDeg: 10 },
      { t: 0.7, fov: 30, distR: 1.35, tiltDeg: 32 },
      { t: 1.0, fov: 28, distR: 'fit', tiltDeg: 48, screenOffsetX: -0.12 },
    ],
    open: { ms: 1600, ease: [0.65, 0, 0.35, 1], fovTiltLagMs: 120, fovTiltEase: [0.33, 1, 0.68, 1] },
    close: { ms: 1200, ease: [0.32, 0, 0.15, 1] },
    settle: { ms: 400, overshoot: 0.015 },
    idleYawDegPerSec: 0.6, idleResumeMs: 3000,
    arcsStartAt: 0.75, labelFadeMs: 250,
    reducedMotion: 'cut',
  },
} as const;
```

### Mobile performance budget

Target: 60 fps on iPhone 12 and Pixel 7 class. Hold 30 fps minimum on older phones in low tier. Frame budget 16 ms, with 10 ms or less on the GPU.

| Item | Desktop | Phone high | Phone low |
|---|---|---|---|
| DPR cap | 2.0 | 2.0 | 1.5 |
| Adaptive DPR floor (drei `PerformanceMonitor`) | 1.25 | 1.25 | 1.0 |
| Bloom | on | on, half-res | off, fake glow quads |
| MSAA | 4x | off (bloom pass handles it) | off |
| Globe mesh | 256 x 128 segments | 128 x 64 | 96 x 48 |
| Globe relief texture (baked, KTX2/Basis) | 8192 x 4096 | 4096 x 2048 | 2048 x 1024 |
| Trip close tile (relief for the region) | 2048 x 2048 | 2048 x 2048 | 1024 x 1024 |
| Land mask (R = land, G = coast distance) | 4096 x 2048 | 2048 x 1024 | 2048 x 1024 |
| Coastline vertices | 60k | 25k | 12k |
| Visible legs at once | 200 | 80 | 40 |
| Points per leg | 64 | 48 | 32 |
| Total line vertices | 25k | 6k | 2.5k |
| Draw calls | under 80 | under 40 | under 25 |
| HTML labels mounted | 40 | 16 | 10, rest on tap |
| Shadows | off (relief is baked) | off | off |
| GPU texture memory | under 256 MB | under 96 MB | under 48 MB |

- Pick the tier once at boot with `detect-gpu`. Drop a tier if `PerformanceMonitor` reports under 50 fps for 2 s.
- Use `frameloop="demand"` when idle drift is off and nothing animates.
- Merge all legs of one mode into one `LineSegments2` per mode. Avoid one mesh per leg.

---

## Deliverable 2: Leg mode styles

All legs share the `route` color. Mode reads through shape, height, dash and motion. Only the current leg's endpoint takes `accent`. Points are sampled on the great circle between stops with `slerp` on unit vectors, then lifted along the normal by `h(t)`.

Let `d` be the great-circle angle in radians between the endpoints (`d = km / 6371`). Let `t` run from 0 to 1 along the leg.

### Fly

- Shape: a high great-circle arc.
- Altitude: `h(t) = H * sin(PI * t)` with `H = clamp(0.08 + 0.35 * d, 0.04, 0.55)` in R units.
  - Lisbon to Rome (about 1,860 km): H is about 0.18.
  - New York to Tokyo (about 10,850 km): H is about 0.55 (capped).
  - Short hop (300 km): H is about 0.10, clamped to stay readable.
- In trip view, scale H by 0.5 so arcs do not leave the frame at 48 deg tilt.
- Line: solid, 1.5 px, glow on. Traveling dot on.
- Draw-in from origin to destination using `progress`.
- Points: `clamp(16 + 48 * d, 16, 64)`.

### Drive

- Shape: hugs the ground. Follows the road polyline when available, else the great circle.
- Offset: `0.0004 R` (about 2.5 km) above the surface on the globe. `0.00015 R` in trip view. Use `polygonOffset` and `depthTest: true` so relief does not clip it.
- Line: 1.25 px, solid, no traveling dot glow (dot core only, 3 px).
- Small arrow chevrons every 120 px, 4 px wide, at 60% opacity, to show direction.
- Simplify road geometry to 1 point per 2 km on the globe and 1 per 250 m in trip view.

### Train

- Shape: ground-hugging like drive, offset `0.0005 R`.
- Line: 1.25 px solid core plus a second 0.5 px line offset 3 px to each side at 35% opacity. Reads as rails.
- Sleeper ticks: 4 px perpendicular ticks every 10 px. Only in trip view.
- Traveling dot: 4 px, faster loop (2.5 s).

### Boat and cruise

- Shape: on the water. Follows the great circle or a supplied sea route. Offset `0.0002 R`.
- Line: 1.0 px dashed. Dash 6 px, gap 4 px, at 80% opacity.
- Wake: a widening V trail behind the moving dot that disturbs the ocean hatch.
  - Wake length: 0.035 R on the globe, 0.06 R in trip view.
  - Wake half-angle: 19.5 deg (Kelvin wake).
  - Wake fade: opacity `0.55 * (1 - s)^2` along length `s`.
  - Hatch displacement: hatch lines inside the wake shift by up to 2 px and brighten to 30% opacity.
  - Foam core: 2 px line in `route.core` behind the dot, 25% opacity, length 0.01 R.
  - Speed: the dot loops every 6 s. Boats feel slow.
- Cruises with several ports use the same style. Each port stop gets a beam.

### Walk

- Shape: ground-hugging. Hidden on the globe view. Shown when camera distance is under 1.3 R.
- Line: 1.0 px dotted. Dot 1.5 px, gap 5 px. 70% opacity.
- No traveling dot.

### Mode summary token

```ts
export const legModes = {
  fly:   { lift: 'arc', H: (d: number) => Math.min(Math.max(0.08 + 0.35 * d, 0.04), 0.55), tripScale: 0.5, px: 1.5, dash: null, dot: { px: 4, loopMs: 4000 } },
  drive: { lift: 0.0004, liftTrip: 0.00015, px: 1.25, dash: null, chevronEveryPx: 120, dot: { px: 3, loopMs: 4000 } },
  train: { lift: 0.0005, px: 1.25, rails: { px: 0.5, offsetPx: 3, opacity: 0.35 }, ticksEveryPx: 10, dot: { px: 4, loopMs: 2500 } },
  boat:  { lift: 0.0002, px: 1.0, dash: [6, 4], opacity: 0.8, wake: { lenR: 0.035, lenRTrip: 0.06, halfAngleDeg: 19.5, opacity: 0.55, hatchShiftPx: 2, hatchBoost: 0.30 }, dot: { px: 4, loopMs: 6000 } },
  walk:  { lift: 0.0001, px: 1.0, dash: [1.5, 5], opacity: 0.7, showBelowDistR: 1.3, dot: null },
} as const;
```

---

## Implementation notes (three.js / R3F)

- Stack: `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`. WebGL2 renderer for v2. Keep TSL and `WebGPURenderer` as a later swap. Write shaders so their logic ports cleanly to TSL nodes.
- Lines: use `Line2` / `LineSegments2` with `LineMaterial` from `three/examples/jsm/lines`. Set `worldUnits: false`, `linewidth` in px, and update `resolution` on resize with the capped DPR. Use `dashed: true`, `dashSize`, `gapSize` for boat and walk. Call `computeLineDistances()` after building geometry.
- Draw-in: patch `LineMaterial` with `onBeforeCompile`. Add a `uProgress` uniform and discard fragments where the instance line distance divided by total length is over `uProgress`. Pass normalized distance as an instanced attribute.
- Back-face fade: in the same patch, fade by `smoothstep(-0.05, 0.1, dot(normalize(worldPos), viewDirFromCenter))`.
- Globe material: one `ShaderMaterial` (or `MeshBasicMaterial` with `onBeforeCompile`). Inputs are the baked relief texture, the land mask, and uniforms `uHatchSpacing`, `uHatchAngle`, `uHatchOpacity`, `uWakes[8]` (vec4: position xyz, heading), `uLimbColor`. No lights needed since relief is baked.
- Hatch: `float h = abs(fract(dot(gl_FragCoord.xy / dpr, dir) / spacing) - 0.5) * spacing;` then `smoothstep(0.5 + aa, 0.5, h)`. Mask with ocean. Fade with limb.
- Wake: per fragment, project position into each active boat's local frame. Inside the V (`abs(y) < x * tan(19.5 deg)` and `0 < x < len`) offset the hatch phase by `shift * (1 - x/len)` and boost opacity. Cap at 8 active wakes. On low tier cap at 3.
- Atmosphere: a second sphere at `1.015 R`, `BackSide`, additive, fresnel `pow(1 - dot(n, v), 3) * 0.18`.
- Beams: an `InstancedMesh` of thin quads that face the camera around the normal axis. Additive blending, `depthWrite: false`.
- Dots and fake glow: one `InstancedMesh` of quads with a radial falloff texture.
- Bloom: `<EffectComposer multisampling={0}><Bloom mipmapBlur intensity luminanceThreshold luminanceSmoothing radius /></EffectComposer>`. Mount only when the tier allows it.
- Camera: drive it with one `useFrame` tween using the tokens. Do not combine it with `OrbitControls` damping during a transition. Disable controls while tweening and re-enable on settle. Use `maath/easing` or a small cubic-bezier solver.
- Labels: drei `<Html>` with `occlude` off. Hide them manually with the same back-face test. Use `transform={false}` to keep text crisp. Use `zIndexRange` below the chrome.
- Trip close tile: on open, stream a regional relief tile (KTX2) and blend it over the globe texture by `uTripBlend` during the last 30% of the descent.
- Reduced motion: read `matchMedia('(prefers-reduced-motion: reduce)')`. Set every duration to 0, set `progress = 1`, and stop drift and dot loops.

## Label overlap rule (v1, Prism, 2026-10-12)
- Each label gets a priority: current stop 100, first and last stop 80, stops with photos or notes 60, everything else 40. A tie goes to the earlier date.
- Each frame, project the labels to screen space and place them from highest priority to lowest. Each label's box is padded 6 px. If a box overlaps one already placed, hide that label. Its beam and dot stay visible.
- When two or more pins fall within 28 px on screen, merge them into one cluster label in mono type, such as "CHAMONIX +3". The name comes from the highest-priority pin in the cluster. Tapping the cluster eases the camera in until the pins separate.
- To stop flicker, fade labels in and out over 150 ms. A label must be hidden for 200 ms before it can come back.
- Labels on the far side of the globe, or on a surface tilted more than 75 degrees away from the camera, are hidden.
- Performance: recompute only while the camera is moving and at most once every 100 ms, using a simple grid of screen buckets. Show at most 12 labels on phones and 24 on desktop.

## Camera motion spec (v1, Prism, 2026-10-12)
The camera state is target (lat, lon), altitude h (in R), tilt, heading, FOV and panel offset. Every transition goes from the live state to the final state as one tween. A new target that arrives mid-move restarts the tween from the live state, carrying its current velocity, so the motion never resets.

- Path: the target point moves along the great circle between the start and end points, using slerp on unit vectors. Heading takes the shortest angular route.
- Lift: let d be the angle between the two target points, in radians. The peak altitude is hPeak = max(h0, h1, h0 + (1.2 * d) R), capped at 3.2R, which is the globe view. Altitude follows a smooth hump that peaks at the midpoint of the move: h(t) = lerp(h0, h1, e) + bump * sin(pi * t), where bump = max(0, hPeak - max(h0, h1)). For short hops, where d < 0.05 rad, bump = 0, so the camera glides without lifting.
- Tilt: when bump > 0, tilt eases toward 0 (top-down) at the peak and toward the final tilt on landing. Otherwise tilt eases directly from start to end.
- Duration: T = clamp(700 + 900 * sqrt(d / pi) + 250 * |log2(h1 / h0)|, 600, 2200) ms. A cluster tap uses the same formula, and its altitude only decreases.
- Easing: every channel uses one progress value e = easeInOutCubic(t), the same as cubic-bezier(0.65, 0, 0.35, 1). The bump uses raw t so its peak stays at the middle of the move. The panel offset tweens on the same e.
- Interrupts: blend the old and new tweens over 120 ms, so there is no visible jump in speed.
- Reduced motion: no lift and no path. Crossfade 180 ms to the final state.
- User drag or zoom: cancels the tween instantly, and the live state becomes the drag's starting point.

## Zoom-dependent tilt (backlog, Prism, 2026-10-12)
- Trip view tilt is 48 degrees at the whole-trip framing. It ramps smoothly to 62 degrees as the camera descends from 20 km to 8 km. Use smoothstep on altitude for the ramp.
- Exiting trip view returns to map height over the same trip region with tilt 0, in one camera move. Do not reset to the default home view.

## Leg mode styles (v1, build spec)
Shared rules:
- Line2 with LineMaterial, width in screen px. Leg color #5CC8E4. The active leg stays cyan, 1.5x wider at full opacity, with the moving head. #FF3311 is reserved for the current stop only.
- Each leg draws in from start to end over 900ms when a trip opens. A small glowing head (3px) then loops from start to end so direction is always readable.
- A pinless endpoint (airport or stopover) gets a 4px hollow ring with no label.
- Reduced motion: no draw-in and no moving head. Static lines only.
- Flights render above surface legs. Surface legs use the same zoom-scaled lift as borders.

Modes:
- **Fly:** great-circle arc, H = clamp(0.08 + 0.35d, 0.04, 0.55)R, d in radians, 96 segments. 1.5px solid, fading to 40% opacity in the last 8% at each end. Outbound and return on the same route are offset 4 degrees to either side.
- **Drive:** flat on the surface. 1.25px solid at 80% opacity. Chevrons every 24px on screen point in the travel direction.
- **Train:** flat. 1.5px solid with cross ticks 5px long, 1px wide, every 10px on screen.
- **Boat (ferry, short hops):** flat. Dashed 6px on, 4px off, 1.25px. The moving head trails a V wake with a 19.5 degree half-angle, 40px long, fading out.
- **Cruise (multi-day):** flat. Dots of 2px every 8px, so it reads heavier than a boat. Same wake as boat but 1.5x wider. Each port along the way gets a small ring marker.
- **Walk:** flat. Fine dots of 1px every 5px at 60% opacity, with no head and no wake. That keeps it lighter than a cruise.
- **Other:** flat. A 1px solid line at 60% opacity, with no decoration.
