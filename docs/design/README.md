# Handoff: Pika-History — Timeline Study Helper

## Overview
Pika-History is a study tool built around a **horizontal, multi-track historical timeline**. History is laid out left→right by year (3000 BCE → present). Continents are stacked as horizontal **bands**; within each band, civilizations sit as **segments on lane lines** (a civ's start→end drawn as a connected stream). Clicking an era icon opens a **study note** (markdown + media + sources) docked at the bottom; the timeline "lights up" to show where that note lives. An AI strip at the bottom of the note suggests a related rabbit-hole ("have you heard how they made bronze…?"). Users can add events, which **branch off into new sub-streams** on adjacent lanes.

## About the Design Files
The file in this bundle (`Pika-History.dc.html`) is a **design reference created in HTML** — a prototype showing the intended look and behavior. It is **not production code to copy directly**. It was authored in a proprietary "Design Component" format that depends on a custom runtime (`support.js`), so it will not run standalone. Treat it as a visual + behavioral spec.

**Your task:** recreate this design in the target codebase's existing environment (React, Vue, Svelte, etc.) using its established patterns, component library, and state management. If no environment exists yet, pick the most appropriate framework and implement there. Everything you need to rebuild it — layout math, exact colors, typography, spacing, data model, and interactions — is documented below, so you should not need to reverse-engineer the source file.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and layout are specified. Recreate the UI faithfully using the codebase's libraries. The one caveat: the current mock is a **static visual mockup** — only the zoom controls are wired to real behavior. Note-opening, icon selection, add-event, and the AI suggestion are visual only and need real implementation (see Interactions).

---

## Layout — Overall Shell
A full-viewport (`100vh`) flex **column** with three rows:

1. **Header** — fixed height `62px`.
2. **Timeline area** — `flex: 1`, fills remaining height, horizontally + vertically scrollable. This is the hero.
3. **Note dock** — fixed height `342px`, pinned to the bottom.

- App background: `#f4efe4` (warm parchment). Base font: **Work Sans**. Text color: `#2b2620`.
- A CSS custom property `--accent` (default `#e8a90c`, warm gold) drives all accent color. Make it a themeable token.

---

## Screen: Timeline (primary view)

### Header (62px)
- Background `#fbf8f0`, bottom border `1px solid #e6dfce`, horizontal padding `22px`, `space-between`.
- **Left — logo lockup:**
  - Circular badge: `40px`, `border: 2px solid var(--accent)`, background `#f4efe4`, subtle gold shadow `0 2px 6px rgba(232,169,12,.25)`. Contains a **bolt** glyph (Material Symbols, filled), `24px`, gold.
  - Wordmark (Spectral serif, `22px`, weight 700): `Pika` + a small gold bolt glyph (17px, replacing the hyphen) + `History`.
  - Sub-label below (IBM Plex Mono, `9px`, letter-spacing `.22em`, `#9a917f`): `STUDY TIMELINE`.
- **Right — controls (all decorative placeholders):**
  - Search pill: `230px`, pill radius `999px`, bg `#f4efe4`, border `#e6dfce`, search glyph + "Search eras, people, places…" (`#9a917f`).
  - "All continents ▾" filter pill (same pill style).
  - Avatar: `36px` circle, bg `#e7ead9`, border `#d7d9c4`, serif "M" in `#4d6b53`.

### Timeline scroll area
- Wrapper is `position: relative` and holds both the scroll `<section>` and the floating zoom control.
- Scroll `<section>`: `overflow: auto`, background `linear-gradient(180deg, #f4efe4, #f1ebdd)`.
- Inner track: `position: relative`, `width: {innerWidth}px` (computed, see Time Scale), `min-width: 100%`. Everything below is positioned inside this track.

#### Time ruler (sticky top, 46px)
- `position: sticky; top: 0`, height `46px`, background `rgba(244,239,228,.96)` + `backdrop-filter: blur(2px)`, bottom border `#e6dfce`, `z-index: 12`.
- A sticky **left cap** (`width: 132px`, `left: 0`, bg `#f4efe4`, right border, mono label `TIMELINE`) sits over the label gutter.
- **Tick marks** for years `[-3000, -2000, -1000, 0, 500, 1000, 1500, 2025]`. Each: absolutely positioned at `left = X(year)`, `translateX(-50%)`, a mono label (`10px`, `#7c7360`) above a `1px × 8px` `#cbbfa5` tick line. Label format: negative → `"3000 BCE"`, zero → `"1 CE"`, positive → `"500 CE"`.

#### Context guide line (the "lit-up" indicator)
- A vertical line at the active note's position: `left = activeX`, `top: 46px`, `height: 600px` (covers the 4 bands), `width: 2px`, `translateX(-50%)`.
- Background `linear-gradient(180deg, var(--accent), rgba(232,169,12,.12))`, `z-index: 3`, `pointer-events: none`.
- A `10px` gold dot at its top with a `0 0 0 4px rgba(232,169,12,.2)` halo.
- In the mock `activeX = X(-1300)` (the Bronze branch). Bind this to the currently open note's x-position.

#### Continent bands (×4)
Each band: `position: relative`, `height: 150px`, bottom border `1px solid #eae3d2`, background = band tint.

Band tints & label colors:
| Band | tint | label color | segment color |
|------|------|-------------|---------------|
| Africa | `#f2e8d7` | `#8a6d3b` | `rgba(138,109,59,.30)` |
| Asia | `#ebe8de` | `#5f6b4a` | `rgba(95,107,74,.30)` |
| Europe | `#e8ebda` | `#4d6b53` | `rgba(77,107,83,.30)` |
| Americas | `#f0e5dd` | `#8a5a44` | `rgba(138,90,68,.30)` |

Within each band:
- **Two lane baselines** (the "timeline lines" civilizations sit on): dashed horizontal lines at `top: 54px` (lane 0) and `top: 110px` (lane 1), spanning `left: 140px` → `right: 24px`, `border-top: 1px dashed {band.label}`, `opacity: .3`.
- **Sticky band label** (`left: 0`, `width: 132px`, full height, `z-index: 8`, bg = band tint, right border `#e0d8c4`): continent name in Spectral serif (`17px`, 600, band label color) + mono sub-label `CONTINENT` (`9px`, `#9a917f`).
- **Civilization segments** — one per civ (see Data Model). Each is a wrapper positioned at `left: X(start)`, `top: laneY(lane)`, `width: max(X(end) − X(start), 26)px`, containing three absolutely-positioned children:
  - **Bar** (the stream line): `left: 0; top: -3px; height: 6px; width: 100%; border-radius: 3px`. Fill = segment color (normal), or `var(--accent)` with glow `0 0 10px rgba(232,169,12,.5)` (active), or `var(--accent)` at `opacity: .85` (branch).
  - **Icon** (`34px` circle centered on the line): `left: -17px; top: -17px`. Normal: bg `#fbf8f0`, border `1.5px solid #d9cfb8`, glyph color `#7c7360`, shadow `0 1px 3px rgba(0,0,0,.05)`. Active: bg + border `var(--accent)`, glyph `#2b2620`, halo `0 0 0 5px rgba(232,169,12,.16)` + `0 4px 12px rgba(232,169,12,.4)`, **pulse animation** (see Tokens). Branch: bg `#fbf8f0`, `2px solid var(--accent)`, glyph `#8a6a0c`, shadow `0 2px 8px rgba(232,169,12,.28)`. Glyph is a Material Symbols icon at `19px`.
  - **Label** (above icon): `left: -14px; top: -46px; white-space: nowrap`. Line 1 = civ name (Spectral, `11.5px`, 600; color `#3a342b` normal or `#8a6a0c` active/branch) + optional mono `NEW STREAM` tag in gold. Line 2 = date range (IBM Plex Mono, `8.5px`, `#9a917f`), e.g. `"1600 BCE – 1046 BCE"`.

#### Branch connector (added-event / sub-stream demo)
- When a civ event branches to a new lane, draw a **dotted elbow**: `position: absolute; left: X(branchYear); top: laneY(fromLane); height: laneY(toLane) − laneY(fromLane); width: 0; border-left: 2px dotted var(--accent); z-index: 3`, with a `6px` gold dot at its bottom.
- In the mock: Asia band, Shang China (lane 0) branches at year `-1300` down to a new **"Bronze Casting"** stream (lane 1), tagged `NEW STREAM`. This models the general behavior: a user-added event spawns a child stream on an adjacent lane, connected back to its parent.

#### Zoom control (floating, functional)
- `position: absolute; right: 18px; bottom: 18px; z-index: 40`. Vertical stack, bg `#fbf8f0`, border `#e6dfce`, radius `12px`, shadow `0 6px 20px rgba(43,38,32,.14)`.
- Buttons (each `40px` wide, hover bg `#f4efe4`, divider borders `#eee6d4`): **+** (`add` glyph, 38px tall), a **zoom % readout** (mono, 30px tall), **−** (`remove` glyph, 38px tall), **fit** (`fit_screen` glyph, 34px tall).
- Behavior: **+** multiplies zoom ×1.25 (max 2.2), **−** divides ÷1.25 (min 0.55), **fit** resets to 1. Zoom rescales the entire time axis (see Time Scale).

---

## Screen: Note Dock (bottom, 342px)
Background `#fbf8f0`, top border `#e6dfce`, top shadow `0 -6px 24px rgba(43,38,32,.06)`, `z-index: 30`. Flex column with header / body / AI strip. Should be toggleable (a `showNote` flag hides it entirely).

### Note header (padding 12px 22px, bottom border #eee6d4)
- Left: `8px` gold status dot (with `0 0 0 3px rgba(232,169,12,.2)` halo) + title **"Shang Dynasty, China"** (Spectral, `19px`, 700) + a mono date chip `c. 1600–1046 BCE` (bg `#f1ebdd`, border `#e6dfce`, radius `5px`) + tag chips (`#ancient-china`, `#bronze-age`, `#writing`; `11px`, color `#8a6d3b`, bg `#f3ead6`, pill radius).
- Right: a mono "pinned" indicator (gold bolt glyph + `PINNED · ASIA · 1200 BCE`, `10px`, `#9a917f`) and an **Edit** button (edit glyph + label, `13px`, `#6f675a`, border `#e6dfce`, radius `7px`).

### Note body (flex row, fills)
- **Main column** (`flex: 1.7`, scrollable, padding `16px 22px 18px`, right border `#eee6d4`): rendered markdown. Contains: an `h2` (Spectral `16px` 600), a paragraph (`13.5px`, line-height `1.6`, `#443e34`, with `<strong>`), a bullet list (with an inline `<a>` link), and a blockquote (left border `3px solid var(--accent)`, bg `#f6f0e2`, Spectral italic). This is the study-note content — in production it's **user-authored markdown** supporting rich text, images, video/audio embeds, tags, and source links.
- **Right rail** (`flex: 0 0 316px`, scrollable, padding `16px 20px`):
  - `MEDIA` section (mono label): two `74px` tall placeholder tiles (border `#e0d8c4`, radius `8px`, diagonal striped bg `repeating-linear-gradient(45deg, #efe8d8, #efe8d8 7px, #e8e0cd 7px, #e8e0cd 14px)`) — one image slot ("bronze ding vessel"), one video slot (play glyph, "clip · casting demo"). Replace with real upload/embed components.
  - `SOURCES` section: link list (link glyph + text), styled as `<a>`.

### AI suggestion strip (bottom of dock)
- `padding: 12px 22px`, bg `linear-gradient(90deg, rgba(232,169,12,.14), rgba(232,169,12,.05))`, top border `1px solid rgba(232,169,12,.35)`.
- Left: `32px` gold circle with a dark bolt glyph (shadow `0 3px 10px rgba(232,169,12,.4)`).
- Middle: Spectral italic (`14px`, `#4a4335`) — the AI prompt, e.g. *"Based on your notes — have you heard how Shang foundries cast ritual bronzes in **ceramic piece-molds**, not lost-wax?"*
- Right: **Explore →** button (bg `#2b2620`, text `#f4efe4`, radius `8px`, `13px`, arrow glyph).

---

## Time Scale (core math)
Linear mapping from year to x-pixel, scaled by zoom `z`:

```
X(year, z) = round( 150 + ((year + 3000) / 5025) * 1820 * z )
```
- Domain: `year ∈ [-3000, 2025]` (5025-year span). `150` is the left offset (past the label gutter); `1820` is the base usable width at `z = 1`.
- `innerWidth = X(2025, z) + 40` → the width of the scrollable inner track.
- `laneY(lane) = lane === 0 ? 54 : 110` (px within a 150px band).
- Zoom recomputes all X positions; memoize results per zoom level to avoid recompute on every render.

> Note: linear scale compresses the modern era. If the team prefers, swap in a piecewise/log scale (denser pre-1CE, expanded post-1500) — only `X()` changes; everything else is derived from it.

---

## Interactions & Behavior
**Currently wired:** zoom +/−/fit only.
**To implement:**
- **Click a civilization icon** → open its note in the dock, set `activeX` to that civ's x, apply the active (gold/pulse) styling to that icon, and drop the vertical guide line at its position.
- **Add event** → user creates a new event on a civ's stream; if it diverges, render it as a branch (elbow connector + new lane segment, `NEW STREAM` tag).
- **Edit / author note** → markdown editor with image + media embeds, tags, and source links (per the study-note content model).
- **AI "Explore →"** → given the note text, request a single friendly follow-up suggestion; render it in the strip; clicking navigates to / creates the suggested topic.
- **Search & continent filter** (header) → filter visible bands/civs.
- **Horizontal pan** → scroll; consider drag-to-pan.
- Transitions: icon state changes use `transition: all .2s`. Active icon uses the `pulse` keyframe (2s infinite).

## State Management
- `zoom` (number, default 1; clamp `[0.55, 2.2]`).
- `activeNoteId` (which civ/event is open) → drives dock content, `activeX`, and active icon styling.
- `showNote` (bool) → dock visibility.
- `guide` (bool) → guide-line visibility.
- `accent` (string) → theme color token (`--accent`).
- Timeline data (bands → civs → events) and per-event notes; notes are user data (markdown + media + tags + sources) and need persistence/fetching.

## Design Tokens
**Colors**
- App bg `#f4efe4`; panel/surface `#fbf8f0`; timeline gradient `#f4efe4 → #f1ebdd`.
- Text `#2b2620`; body copy `#443e34`; muted `#6f675a`; faint mono `#9a917f`.
- Hairlines/borders `#e6dfce`, `#eee6d4`, `#eae3d2`, `#e0d8c4`, `#d9cfb8`.
- **Accent (gold)** `#e8a90c` (`--accent`); deep gold text `#8a6a0c`. Accent tints: `rgba(232,169,12,.05–.5)`. Alt accent options offered in mock: `#d4623a`, `#3a7d6b`, `#7a5cc4`.
- Band tints & label/segment colors: see band table above.
- Tag chip: text `#8a6d3b` on `#f3ead6`.

**Typography**
- Serif (headings, civ names, logo, note titles): **Spectral** (weights 400/500/600/700, plus italic for quotes & AI prompt).
- Sans (UI/body): **Work Sans** (400/500/600).
- Mono (dates, labels, meta): **IBM Plex Mono** (400/500).
- Icons: **Material Symbols Outlined** (opsz 24). Glyphs used: `bolt`, `search`, `expand_more`, `add`, `remove`, `fit_screen`, `edit`, `image`, `play_circle`, `link`, `arrow_forward`, and era glyphs `change_history` (pyramid), `sailing`, `history_edu`, `mosque`, `auto_stories`, `water_drop`, `temple_buddhist`, `local_fire_department`, `account_balance`, `flag`, `stadium`, `castle`, `factory`, `temple_hindu`, `agriculture`, `rocket_launch`.

**Radius:** pills `999px`; cards/tiles `8–12px`; chips `5–7px`. **Band height** `150px`; **lane bar** `6px` tall; **era icon** `34px`.

**Shadows / keyframes**
- Zoom control: `0 6px 20px rgba(43,38,32,.14)`. Dock: `0 -6px 24px rgba(43,38,32,.06)`.
- `@keyframes pulse` (active icon, `2s infinite`): box-shadow expands `0 0 0 0 → 0 0 0 12px` of `rgba(232,169,12, .35 → 0)`, plus a constant `0 4px 12px rgba(232,169,12,.4)`.

## Data Model (recommended shape)
```
Band { name, tint, labelColor, segColor, branchAt?, branchFrom?, branchTo?, civs: Civ[] }
Civ  { name, glyph, start: year, end: year, lane: 0|1, active?, branch? }
// year is a signed integer (negative = BCE). Notes attach per Civ/event id.
```
The mock's exact seed data (all four bands, ~18 civs, plus the Shang→Bronze branch at −1300) lives in `bandDefs()` inside `Pika-History.dc.html` — copy the values from there.

## Assets
- No bitmap assets. Icons come from **Material Symbols Outlined** (Google Fonts). Media tiles in the note are striped CSS placeholders — replace with real image/video components in production.
- Fonts: Spectral, Work Sans, IBM Plex Mono, Material Symbols Outlined — all from Google Fonts.

## Screenshots
In `screenshots/`:
- `01-timeline-overview.png` — full app at 100% zoom: header/logo, the four continent bands with civilization stream lines, the active Shang China node (gold/glow), the branched **Bronze Casting → NEW STREAM**, the vertical context guide line, the note dock, and the AI suggestion strip.
- `02-timeline-zoomed-out.png` — same view at 64% zoom, showing more of the time axis (demonstrates the zoom control rescaling the whole timeline).
- `03-note-dock-and-ai-suggestion.png` — close-up of the bottom note dock: title/tags/pinned meta, markdown body, media + sources rail, and the gold AI suggestion strip.

## Files
- `Pika-History.dc.html` — the design reference (Design Component format; needs its runtime to render, so read it as a spec rather than running it). All seed data and exact style strings are inside it.
- `screenshots/` — rendered reference images (see above).
