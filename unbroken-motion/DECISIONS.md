# Unbroken Motion — Architectural Decisions & Licensing Log

**Skill Name:** `unbroken-motion`
**Status:** v0.1.0 (Active Implementation)
**Platform Target:** Windows 11 (x64), Node.js v24+, Antigravity Workspace Skill

## 1. Locked Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Render Engine** | **Remotion v4** (`remotion`, `@remotion/cli`, `@remotion/renderer`) | Deterministic frame seeking, Chromium CSS/SVG fidelity, React component model, bundled compositor (`ffmpeg`/`ffprobe`). |
| **Language** | TypeScript (ES2022, erasable TS syntax) + ESM Node scripts (`.mjs`) | Enables Node 24 native type-stripping (`manifest.mjs` runs `scene.ts` directly in `< 200 ms` with zero build step) while compiling cleanly inside Remotion. |
| **Coordinate Stage** | Center-origin design coordinate space (`1920x1080` for `16:9`, `1080x1920` for `9:16`, `1080x1080` for `1:1`) | Keeps camera `(x, y)` centered at `(0, 0)` regardless of aspect ratio and makes safe-zone projection aspect-agnostic. |
| **Time Model** | Continuous sub-frame time (`useContinuousFrame() = frame + shutterOffset`) | Decouples physics/springs from integer frames so 180-degree shutter supersampling evaluates intermediate motion states accurately. |
| **Motion Blur** | Hybrid: directional velocity CSS/SVG blur in `--draft`; $N$-sample temporal supersampling via `ffmpeg tmix` in `--final` | Fast iteration (`~10s` drafts) paired with true cinema shutter blur on final 4K60 delivery. |
| **Manifest & Verification** | Single-source-of-truth `scene.ts` evaluated per frame in Node (`manifest.mjs`) + static source audit + `ffmpeg astats`/`ebur128` (`verify.mjs`) | Eliminates drift between React rendering and continuity measurements while keeping verification fast enough for tight agent loops. |
| **Audio Engine** | Procedural CC0 WAV synthesizer (`synth-sfx.mjs`) + `ffmpeg -filter_complex_script` mixer (`sound.mjs`) | Guarantees zero missing assets, zero copyright issues, and zero Windows command-line escaping failures. |
| **FFmpeg Resolution** | Checks `FFMPEG_PATH` / `PATH` first, then falls back to `@remotion/compositor-win32-x64` bundled binaries | Works seamlessly on Windows 11 even when `ffmpeg` is not manually added to the global system `PATH`. |
| **Workspace Topology** | Skill package holds docs, schemas, scripts & `templates/starter/`; `scaffold.mjs` creates runnable film projects in `cases/<film>` | Prevents Webpack/Rspack external-path resolution bugs and lets films share installed dependencies via Windows directory junctions. |

## 2. Licensing & Compliance Notes

1. **Remotion License:** Remotion is source-available under the Remotion License. Free for individuals and companies with $\le 3$ employees (check current thresholds at `https://www.remotion.dev/license` before commercial client work; commercial company licenses apply above the free tier).
2. **Fonts:** Use system-safe or OFL-licensed fonts (e.g., Inter, JetBrains Mono, Instrument Serif, Segoe UI, Georgia) and log font licenses in each film's `CREDITS.md`.
3. **Audio & SFX:** `scripts/synth-sfx.mjs` synthesizes 100% original 48 kHz PCM WAV files mathematically from oscillators and filtered noise (CC0 / public domain equivalent). Any third-party music stems added to a project must be logged in `cases/<film>/CREDITS.md`.
4. **Clean-Room Rule:** All motion math, camera solvers, carry helpers, reference manuals, and benchmark films in this skill are authored from scratch.
