# Hero-First Vector UI Reconstruction (`references/ui-rebuild.md`)

**Rule:** Never composite raw product screenshots (`<img>` / screen recordings) as zoomed motion layers. Screen recordings blur under push-through zoom, freeze internal states, and lock individual buttons inside flat pixels so they cannot detach across beats.

Instead, inspect the user's screenshot (or product brief) and reconstruct the UI in pure resolution-independent vector/DOM code using `src/lib/ui-kit.tsx` and the active brand file.

---

## 1. The 3-Layer Decomposition Method

Break every product screen down into three clean abstraction layers before coding:

### Layer 1: Shell (Minimal Chrome)
- **What to include:** Outer application frame (`AppWindow` or `PhoneFrame`), clean backdrop surface, minimal corner radius matching `brand.geometry.radiusLg`, optional subtle 3-dot window header or single slim sidebar rail.
- **What to strip out:** OS taskbars, browser bookmarks, scrollbars, noisy secondary chrome, user avatar clutter.

### Layer 2: Context (Simplified Semantic Hierarchy)
- **What to include:** 2–4 clean supporting cards, slim muted skeleton bars (`height: 8–10px`, `opacity: 0.25`) representing secondary paragraphs, crisp section headers (2–4 words max).
- **What to strip out:** Dense 12-column spreadsheets, tiny 9px footnote labels, repetitive table cells that distract the viewer at video pace.

### Layer 3: Hero Vector Actors (10× Zoom Ready)
- **What to include:** Every element that animates, receives focus, or participates in a beat `handoff`:
  - Command / prompt inputs (`CommandBar`)
  - Interactive menu rows (`MenuRow`) and floating chips (`Chip`)
  - Primary CTA buttons (`Button`) and status badges (`MetricBadge`)
  - Vector cursor (`Cursor`) and clean inline SVG icons (never raster PNG icons!)
- **Engineering Standard:** Every Hero Actor must be wrapped in `<Actor>` with deterministic `worldBox` coordinates so `manifest.mjs` and `verify.mjs` track it across frames.

---

## 2. Readability & Typography Rules for Video

Web UIs are read at arm's length for minutes; launch videos are scanned on phones in **1.5 seconds**. Scale UI proportions accordingly:

| UI Property | Web App Default | Video Rebuild Target (1920×1080 Design Space) |
|---|---|---|
| Headline / Card Title | `16–20 px` | **`28–42 px`** (bold, tight tracking `-0.02em`) |
| Body / Menu Item Text | `13–14 px` | **`20–26 px`** (max 3–5 words per line) |
| Badge / Chip Text | `11–12 px` | **`16–20 px`** (uppercase or semibold pill) |
| Button / Input Height | `36–40 px` | **`56–76 px`** |
| Minimum Stroke Width | `1 px` | **`1.5–2.5 px`** (prevents sub-pixel shimmer during motion) |

---

## 3. Adapting Across Aspect Ratios (`16:9`, `9:16`, `1:1`)

`Stage.tsx` maintains a center-origin coordinate space tailored to the target `aspectRatio`:
- **`16:9` (1920×1080):** Wide stage (`x ∈ [-960, 960]`, `y ∈ [-540, 540]`). Place side-by-side panels horizontally (`x = ±360`).
- **`9:16` (1080×1920):** Vertical stage (`x ∈ [-540, 540]`, `y ∈ [-960, 960]`). Keep hero components `width <= 840` so `90%` safe zone holds, and stack transitions vertically (`whip` up/down instead of wide horizontal pans).
- **`1:1` (1080×1080):** Square stage (`x ∈ [-540, 540]`, `y ∈ [-540, 540]`). Center hero cards within `780×780`.

---

## 4. Token Enforcement Checklist (Gate G7)

Before finalizing any UI rebuild:
1. All fills, borders, shadows, and text colors come from `brand.colors.*`.
2. Font families come strictly from `brand.typography.*`.
3. Border radii use `brand.geometry.radiusSm / radiusMd / radiusLg`.
4. Zero raw `#hex`, `rgb()`, or `rgba()` literals exist inside `src/compositions/` or `src/scene.ts`.
