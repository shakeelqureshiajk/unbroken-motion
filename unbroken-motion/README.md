# Unbroken Motion

**A deterministic, single-camera Remotion skill for producing unbroken product launch films, UI demos, kinetic typography teasers, and brand reels with zero hard cuts.**

Every beat physically grows out of the previous one using continuous spatial handoffs (`carry`), single-camera trajectory solving, rebuilt vector UI actors, procedural CC0 audio, and automated visual + quantitative verification (`G1`–`G7`).

---

## Core Philosophy

1. **Zero Hard Cuts (`carryScore = 1.0`):** Every beat boundary shares an active, transforming `<Actor>` across a centered `handoff.windowSec` using one of five physical carry modes:
   - `morph` — one form continuously reshapes into another (e.g., dot seed -> command bar).
   - `tether` — an anchor element travels along a physical bridge while the camera pans.
   - `detach` — a UI sub-element lifts out of a list or shell to become the next beat's hero.
   - `portal` — the camera pushes through an expanding frame directly into the next view.
   - `collapse` — an expanded layout folds back cleanly into a badge or signature mark.
2. **One Continuous Camera:** Camera presets (`follow`, `whip`, `pushThrough`, `float`, `shake`, `hold`) blend smoothly across boundaries using logarithmic zoom interpolation and seeded simplex drift.
3. **3-Layer Vector UI Rebuilds:** Never pan or zoom static screenshots. Hero UI elements are rebuilt from resolution-independent components in [`src/lib/ui-kit.tsx`](./templates/starter/src/lib/ui-kit.tsx) with a clean shell, semantic content, and a kinetic hero anchor.
4. **Pure-Function Determinism:** Frame states depend strictly on `useContinuousFrame()` (`frame + shutterOffset`) and an explicit integer `seed`—never `Math.random()`, `Date.now()`, or raw `useCurrentFrame()`. Identical evaluation powers both React/Remotion rendering and Node telemetry generation.
5. **Visual & Quantitative Gatekeeping:** No draft is shown and no `--final` 4K60 master renders unless all 7 automated gates (`G1`–`G7`) pass and annotated diagnostic contact sheets (`boundary-handoffs.png`, `beat-overview.png`) are inspected.

---

## Repository & Skill Structure

```text
Unbroken-Motion/
├── README.md
├── unbroken-motion.zip                     # Distributable skill archive (Claude Web/Desktop)
├── unbroken-motion-skill-plan.md           # Build architecture & milestone blueprint
└── unbroken-motion/                        # Skill root
    ├── SKILL.md                            # Core agent instructions & hard rules
    ├── README.md                           # Bundled skill README
    ├── DECISIONS.md                        # Architectural ADRs
    ├── CHANGELOG.md                        # Version history & hardened rules log
    ├── references/
    │   ├── principles.md                   # Core motion & continuity manifesto
    │   ├── rhythm.md                       # Asymmetric timing & rest-ratio rules
    │   ├── camera.md                       # Continuous camera presets & curves
    │   ├── carry-patterns.md               # Morph, tether, detach, portal, collapse specs
    │   ├── ui-rebuild.md                   # 3-layer vector UI architecture
    │   ├── sound.md                        # SFX synthesis, reverb, ducking, -14 LUFS mastering
    │   ├── rejected-cuts.md                # Logged failures promoted to G1-G7 & SKILL.md rules
    │   └── brands/
    │       ├── _template.md                # Starter template for new brands
    │       ├── obsidian-tech.md            # Dark slate/cyan/indigo tech brand ("VECTRA")
    │       └── warm-editorial.md           # Sunlit linen/terracotta editorial brand ("ATELIER")
    ├── schema/
    │   ├── beats.schema.json               # JSON Schema Draft 2020-12 for beats sheets
    │   └── brand.schema.json               # JSON Schema Draft 2020-12 for brand tokens
    ├── scripts/
    │   ├── common.mjs                      # Paths, brand loader, schema validator, FFmpeg discovery
    │   ├── scaffold.mjs                    # Creates new film cases from templates/starter
    │   ├── manifest.mjs                    # Evaluates per-frame screenBoxes & velocities (manifest.json)
    │   ├── verify.mjs                      # Automated G1-G7 gate checker
    │   ├── stills.mjs                      # Exact-frame Remotion DiagnosticSheet contact sheets
    │   ├── synth-sfx.mjs                   # Procedural 48kHz CC0 WAV SFX generator
    │   ├── dsp.mjs                         # Pure-Node reverb, sidechain ducking, LUFS & True Peak DSP
    │   ├── sound.mjs                       # Audio stem mixing, -1.85 dB mastering, & MP4 AAC muxing
    │   ├── render.mjs                      # Draft (1080p30), Gallery, & 4K60 4-pass supersampled final
    │   └── test-suite.mjs                  # End-to-end negative, brand-switch, calibration, & benchmark tests
    ├── templates/starter/                  # Remotion starter project & shared motion runtime
    └── cases/                              # Benchmark films & calibration test fixtures
```

---

## Installation & Import

### Prerequisites
- **Node.js 22+ / 24+** (uses native TypeScript type-stripping for fast `manifest.mjs` evaluation without extra build steps).
- **Internet access (first install only):** Required once when running `npm install` in `templates/starter` to download Remotion, Chromium Headless Shell, and bundled FFmpeg.

### 1. Google Antigravity
- **Workspace-local:** Copy the `unbroken-motion/` folder to `<your-project>/.agents/skills/unbroken-motion/`.
- **Global install (available in all projects):** Copy the `unbroken-motion/` folder to `C:\Users\<user>\.gemini\antigravity\skills\unbroken-motion` (or `~/.gemini/antigravity/skills/unbroken-motion` on macOS/Linux).

### 2. Claude Code (CLI / IDE Extension)
- **Global install:**
  ```powershell
  Copy-Item -Recurse -Force ".\unbroken-motion" "$HOME\.claude\skills\unbroken-motion"
  ```
- **Per-project install:** Copy the folder into `<your-project>\.claude\skills\unbroken-motion\`.

### 3. Claude Desktop / Claude.ai Web (`.zip`)
1. Open **Settings -> Capabilities -> Skills** and upload [`unbroken-motion.zip`](../unbroken-motion.zip) (`~325 KB`, excludes `node_modules` and rendered binary artifacts).
2. Whenever extracting `.zip` into a fresh local environment to render `.mp4` videos, run once:
   ```bash
   cd unbroken-motion/templates/starter
   npm install
   ```

---

## Quickstart & CLI Workflow

All commands run from `unbroken-motion/`:

### 1. Scaffold a New Film
```bash
node scripts/scaffold.mjs --name product-launch --brand obsidian-tech --aspect 16:9
```
Supported aspect ratios: `16:9` (`1920x1080` draft / `3840x2160` final), `9:16` (`1080x1920` / `2160x3840`), `1:1` (`1080x1080` / `2160x2160`).

### 2. Author `beats.json` & Pure Scene Motion (`src/scene.ts`)
Edit `cases/product-launch/beats.json` and export `evaluateFilmFrame(beats, brand, continuousFrame)` in `cases/product-launch/src/scene.ts` using `evaluateSceneWithCamera` and helpers from `src/lib/`.

Validate schema and topology immediately:
```bash
node scripts/verify.mjs --film product-launch --schema-only
```

### 3. Fast Metric Pre-Flight (`< 100ms`, No Chrome Render)
Generate frame telemetry and verify `G1`–`G5` + `G7` before rendering pixels:
```bash
node scripts/manifest.mjs --film product-launch && node scripts/verify.mjs --film product-launch
```

### 4. Draft Render, Audio Mix, & Diagnostic Stills
```bash
node scripts/render.mjs --film product-launch --draft
```
This runs the full draft pipeline:
1. Generates `manifest.json`
2. Renders `out/draft.mp4` (`30fps` + directional draft CSS blur)
3. Captures bit-exact boundary & overview frames (`stills/boundary-handoffs.png`, `stills/beat-overview.png`)
4. Synthesizes SFX if missing (`synth-sfx.mjs`), mixes room reverb + ducked bed + `-1.85 dB` PCM mastering (`256k` AAC), and muxes `audio/master.wav` into `out/draft.mp4`
5. Executes `verify.mjs --require-audio`

### 5. Standalone Audio, Stills, & Component Gallery
```bash
node scripts/synth-sfx.mjs                                       # Regenerate CC0 SFX bank
node scripts/sound.mjs --film product-launch                     # Re-mix audio & mux MP4
node scripts/stills.mjs --film product-launch                    # Re-render DiagnosticSheets
node scripts/render.mjs --film product-launch --draft --gallery  # Render out/gallery.mp4 UI showcase
```

### 6. 4K60 Temporal Supersampled Master
Refuses to run unless all gates pass (override only with `--force`):
```bash
node scripts/render.mjs --film product-launch --final --blur-samples 4
```
Renders 4 shutter-offset sub-passes (`[-0.1875, -0.0625, +0.0625, +0.1875]` across a 180-degree shutter) at 4K `60fps` and blends them cleanly in fixed-point raw pixel space into `out/final-4k60.mp4` with verified AAC audio.

### 7. Full Automated Regression Suite
```bash
node scripts/test-suite.mjs
```

---

## Verification Gates (`G1`–`G7`)

| Gate | Name | Pass Criteria |
| --- | --- | --- |
| **G1** | Schema & Carry Topology | Valid `beats.schema.json` + `brand.schema.json`, contiguous `start + duration` timeline, valid carry graph, `windowSec <= 0.5 * min(b0.duration, b1.duration)` |
| **G2** | Boundary Continuity | Across `[fb-4 .. fb+4]`: `opacity >= 0.35`, velocity-compensated `IoU >= 0.55`, per-frame `areaRatio <= 1.25`, centroid jump `<= max(36, 1.35 * localVel1080)`, active motion cheat check (`Δpos > 24px` or `Δscale > 15%`), `carryScore = 1.0` |
| **G3** | Rhythm & Pacing | Beat duration range `max/min >= 2.8`, duration CV `>= 0.28`, rest frames (`speed < 1.5 px/f`) in `[15%, 45%]`, and `>= 8` settle frames `< 3.0 px/f` within `15` frames after any `> 28 px/f` burst |
| **G4** | Framing & Safe Zone | Resting hero actors (`speedNorm < 14`) stay within the `90%` viewport safe zone (`portal` exempted after `areaRatio > 0.65`) |
| **G5** | Velocity Motion Blur | Any camera or visible actor with `speedNorm > 20` has active velocity blur (`blurEnabled && blurStrength > 0`) |
| **G6** | Audio Integrity | Integrated loudness within `-14 +/- 2 LUFS` (`[-16.5, -11.5]`), True Peak `<= -1.0 dBTP` on the muxed `.mp4` AAC stream, and transient RMS alignment on declared events |
| **G7** | Brand Isolation & Determinism | Zero unauthorized/forbidden colors, no hardcoded hex/rgb literals in `src/scene.ts`, and zero `Math.random()`, `Date.now()`, or raw `useCurrentFrame()` calls |

---

## Multi-Brand System

Brands live in `references/brands/<brand-id>.md` with YAML-fenced JSON frontmatter validated against `brand.schema.json`. Built-in themes:
- **`obsidian-tech` (`VECTRA`):** Dark slate canvas (`#070B12`), electric cyan primary (`#38BDF8`), indigo secondary (`#6366F1`), snappy personality.
- **`warm-editorial` (`ATELIER`):** Sunlit linen ivory (`#FBF7F0`), terracotta primary (`#D96B43`), forest emerald secondary (`#1F5C4D`), Georgia serif headings, calm `soft` curves.

To add a brand, copy `references/brands/_template.md`, define `colors`, `typography`, `geometry`, `logo`, `motionPersonality`, and `forbiddenColors`, then reference its `id` in `beats.json`. `render.mjs` and `scaffold.mjs` automatically sync `src/brand.json`.

---

## Benchmark & Calibration Suite

- `_calibration-bad-slideshow` — Intentional hard-cut / flat-rhythm test fixture; verifies `G2` (`carryScore = 0`) and `G3` fail cleanly.
- `_calibration-good-carry` — Reference single-carry continuity fixture; verifies `carryScore = 1.0`.
- `smoke-test` — Starter seed (`morph` + `collapse`) + `Gallery` showcase.
- `01-single-seed` — `obsidian-tech`, `16:9`, `12.60s`: full arc spanning `morph`, `tether`+`whip`, `portal`+`pushThrough`, and `collapse` (includes verified 4K60 master).
- `02-ui-workflow` — `obsidian-tech`, `16:9`, `12.80s`: Layer-1 `appWindow` + vector `cursor` click + `menuRow` `detach` into `chip` inside `commandBar` -> `tether` -> `portal` into 3-card telemetry dashboard -> `collapse`.
- `03-brand-reel-vertical` — `warm-editorial`, `9:16` (`1080x1920`), `12.40s`: vertical mobile launch reel using vertical `tether` into `phoneFrame`, stacked editorial cards, and `ATELIER` resolve.

---

## Combining with Other Skills

`unbroken-motion` is designed to compose cleanly with upstream and parallel skills:
- **Design / Figma Skills:** Extract brand palettes, typography, and component structure into a `references/brands/<brand>.md` token file, then render vector motion without raster assets.
- **Browser Inspection Skills:** Inspect a live web app or localhost prototype to capture layout hierarchy and copy, then rebuild hero screens natively via `ui-kit.tsx`.
- **Copywriting / Marketing Skills:** Author beat timing, hook text, and feature callouts fed directly into `beats.json`.
- **Swarm / Parallel Agent Workflows:** Render `16:9`, `9:16`, and `1:1` campaign variants concurrently across isolated `cases/<slug>` directories and gate all of them with `verify.mjs`.
