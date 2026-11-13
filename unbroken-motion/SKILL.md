---
name: unbroken-motion
description: >-
  Use this skill when creating product launch films, teasers, feature demos,
  kinetic typography videos, or promo reels where every beat must grow out of
  the previous one with one continuous camera and no scene cuts, or when an
  existing motion video feels like a static slideshow and needs continuity.
---

# Unbroken Motion

Produce deterministic, single-camera motion films in Remotion where every beat
physically grows out of the previous one (`carry`), verified quantitatively and
visually before human review.

## 0. Runtime Requirements & Support Tiers
- **Tier 1 (Full Pipeline — Local Terminal):** Requires Node.js `>= 22.6.0`
  (native TypeScript execution), a writable workspace directory, Chromium
  available to Remotion, and network access once for `npm install`.
- **Tier 2 (Author-Only Fallback — Hosted Sandbox / No Terminal):** If local
  Node/Chromium rendering is unavailable, work in author-only mode: pitch
  concepts, author `beats.json` and `src/scene.ts`, and give the user the exact
  CLI commands to render and verify locally.
- **Read-Only Skill Package:** Never write generated films, `manifest.json`,
  `node_modules`, or audio caches inside `<skill-dir>`. All films live in
  `<workspace>/<film-slug>` (defaults to `./unbroken-motion-films/<film-slug>`
  or `UNBROKEN_MOTION_WORKSPACE`).

## 1. Mandatory Intake (Do Not Skip)
Before writing any code or beat sheet, confirm:
1. **Brand:** Locate `references/brands/<brand>.md`. If missing or unspecified,
   stop and ask the user or create one from `references/brands/_template.md`.
2. **Format:** Target duration (e.g., 12–15s), aspect ratio (`16:9`, `9:16`,
   `1:1`), and tone.
3. **UI Assets:** Screenshots or component specs to rebuild as vector actors.

## 2. Step-by-Step Runbook
0. **Environment Check (`doctor`):**
   - Locate `<skill-dir>` (the directory containing this `SKILL.md`).
   - Run `node "<skill-dir>/scripts/doctor.mjs"` and fix any reported failures
     (or switch to Tier-2 author-only mode if running in a hosted sandbox).
1. **Load Context:** Read [principles.md](./references/principles.md),
   [carry-patterns.md](./references/carry-patterns.md), and the active brand file.
2. **Pitch 3 Visual Concepts:** Present 3 one-sentence concepts focused on the
   *physical transformation* (e.g., *"A single cursor click detaches a menu row
   into a command chip, pushing straight through into the live dashboard"*).
   Wait for the user's pick.
3. **Scaffold & Plan (`beats.json`):**
   - Run `node "<skill-dir>/scripts/scaffold.mjs" --name <film-slug> --brand <brand> --aspect <ratio> --install`
   - Read [rhythm.md](./references/rhythm.md) and write `beats.json` in
     `<workspace>/<film-slug>/beats.json` with varied beat lengths, centered
     `handoff` windows, and a fixed integer `seed`.
   - Validate schema immediately:
     `node "<skill-dir>/scripts/verify.mjs" --film <film-slug> --schema-only`
4. **Rebuild UI & Compose:**
   - Follow [ui-rebuild.md](./references/ui-rebuild.md) to author pure-math
     actor trajectories in `<workspace>/<film-slug>/src/scene.ts` using
     `evaluateSceneWithCamera` and `src/lib/ui-kit.tsx`.
   - Wire continuous camera presets (`follow`, `whip`, `pushThrough`, `float`,
     `shake`, `hold`) from [camera.md](./references/camera.md).
5. **Draft, Verify & Visual Self-Check Loop:**
   - Generate manifest, draft MP4, contact sheets, audio, and gate check:
     `node "<skill-dir>/scripts/render.mjs" --film <film-slug> --draft`
   - Run fast metric pre-flight standalone (`< 100ms`) when iterating:
     `node "<skill-dir>/scripts/manifest.mjs" --film <film-slug> && node "<skill-dir>/scripts/verify.mjs" --film <film-slug>`
   - **Mandatory Visual Self-Check:** Open and visually inspect the generated
     image files at `<workspace>/<film-slug>/stills/boundary-handoffs.png` and
     `<workspace>/<film-slug>/stills/beat-overview.png`.
   - Fix any failing gate or visual jump cut before proceeding.
6. **Sound Design:**
   - Read [sound.md](./references/sound.md) and customize `audioEvents` in
     `beats.json`; re-mix with `node "<skill-dir>/scripts/sound.mjs" --film <film-slug>`.
7. **Human Review & 4K60 Master:**
   - Present `<workspace>/<film-slug>/out/draft.mp4` and
     `<workspace>/<film-slug>/stills/boundary-handoffs.png` to the user.
   - Once approved, render the supersampled 4K60 master:
     `node "<skill-dir>/scripts/render.mjs" --film <film-slug> --final --blur-samples 4`

## 3. Hard Rules
- **Zero Hard Cuts:** Every beat boundary must carry a visible `<Actor>` across
  an explicit `handoff.windowSec` with `carryScore === 1.0` (`G2`).
- **Active Carry Only:** Carried elements must actively transform or move across
  the handoff window; static logos or backgrounds cannot count as carries (`G2.4`).
- **Pure Functions of Time:** Never use `Math.random()`, `Date.now()`, or raw
  `useCurrentFrame()` in compositions; always use `useContinuousFrame()` and
  seeded noise (`G7`).
- **No Raster Screen Recordings:** Never zoom into a screenshot PNG/MP4; rebuild
  hero UI actors in resolution-independent vector code.
- **Mandatory Rests & Asymmetric Rhythm:** High-velocity moves and spring settles
  must decay to `< 1.5 px/f` across `>= 8` frames within `15` frames; beat
  durations must vary ($\max/\min \ge 2.8$, rest $15\text{–}45\%$) (`G3`).
- **Separate Whip Translation from Large Scale Growth:** Never pair large area
  morphs (`>3x`) with fast whip pans; orient tether shapes along the whip axis
  and interpolate bounding boxes in log-space with `soft` easing (`G2`).
- **Safe Camera Lifespan Queries:** Clamp camera target sampling inside each
  beat's active window so boundary blends never sample despawned actors.
- **Framing with Portal Exemption:** Keep resting hero actors inside the 90%
  safe zone; exempt `portal` actors only after exceeding 65% viewport area (`G4`).
- **AAC Audio Headroom & MP4 Verification:** Master PCM WAV at `-1.85 dB` ceiling
  (`256k` AAC) and verify `I = -14 +/- 2 LUFS`, `Peak <= -1.0 dBTP` directly on
  the muxed `.mp4` stream (`G6`).
- **Exact Frame Diagnostic Audits:** Generate contact sheets directly via Remotion
  frame renders (`stills.mjs`) rather than lossy `-ss` seeks before visual audit.
- **Strict Brand Isolation:** Never hardcode hex/rgb colors or mix fonts across
  brands (`G7`).
- **Gate Lock:** Never run `--final` or show a draft to the user while
  `verify.mjs` reports any failing gate.
- **Continuous Learning:** Log every rejected cut in
  [rejected-cuts.md](./references/rejected-cuts.md) and promote a rule here.
