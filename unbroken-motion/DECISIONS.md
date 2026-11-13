# Unbroken Motion — Architectural Decisions & Licensing Log

**Skill Name:** `unbroken-motion`
**Status:** v0.2.0 (Cross-Agent Portable Release)
**Platform Target:** Windows, macOS, Linux (x64 & arm64), Node.js `>= 22.6.0` (LTS `22.18+` / `24+`), SKILL.md Standard Agents (Claude Code, Google Antigravity, OpenAI Codex, Cursor, OpenCode, Amp, Claude Desktop/Web)

## 1. Locked Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Render Engine** | **Remotion v4** (`remotion`, `@remotion/cli`, `@remotion/renderer`) | Deterministic frame seeking, Chromium CSS/SVG fidelity, React component model, bundled compositor (`ffmpeg`/`ffprobe`). |
| **Language** | TypeScript (ES2022, erasable TS syntax) + ESM Node scripts (`.mjs`) | Enables Node `>= 22.6.0` native type-stripping (`manifest.mjs` runs `scene.ts` directly in `< 100 ms` with zero build step) while compiling cleanly inside Remotion. |
| **Coordinate Stage** | Center-origin design coordinate space (`1920x1080` for `16:9`, `1080x1920` for `9:16`, `1080x1080` for `1:1`) | Keeps camera `(x, y)` centered at `(0, 0)` regardless of aspect ratio and makes safe-zone projection aspect-agnostic. |
| **Time Model** | Continuous sub-frame time (`useContinuousFrame() = frame + shutterOffset`) | Decouples physics/springs from integer frames so 180-degree shutter supersampling evaluates intermediate motion states accurately. |
| **Motion Blur** | Hybrid: directional velocity CSS/SVG blur in `--draft`; $N$-sample temporal supersampling via raw fixed-point blending in `--final` | Fast iteration (`~10s` drafts) paired with true cinema shutter blur on final 4K60 delivery. |
| **Manifest & Verification** | Single-source-of-truth `scene.ts` evaluated per frame in Node (`manifest.mjs`) + static source audit + `dsp.mjs` BS.1770 LUFS/dBTP metering (`verify.mjs`) | Eliminates drift between React rendering and continuity measurements while keeping verification fast enough for tight agent loops. |
| **Audio Engine** | Procedural CC0 WAV synthesizer (`synth-sfx.mjs`) + pure-Node stereo reverb, sidechain ducking & `-1.85 dB` brickwall mastering (`dsp.mjs`, `sound.mjs`) | Guarantees zero missing assets, zero copyright issues, and consistent `-14 LUFS` / `<= -1.0 dBTP` AAC output across all platforms. |
| **FFmpeg Resolution** | Checks `FFMPEG_PATH` / `PATH` first, then searches `@remotion/compositor-<platform>-<arch>` across Windows, macOS, and Linux (`x64` & `arm64`, `gnu` & `musl`) | Works seamlessly across Windows, macOS, and Linux containers even when `ffmpeg` is not installed globally. |
| **Read-Only Skill & Workspace Topology** | Skill package (`SKILL_ROOT`) is strictly read-only at runtime (`templates/starter/` + slim `examples/`). User films, SFX cache, and `node_modules` live in `<workspace>` (`./unbroken-motion-films` or `UNBROKEN_MOTION_WORKSPACE`). | Prevents mutating global skill installations, eliminates fragile symlinks/junctions by leveraging native Node parent-directory `node_modules` resolution, and keeps the skill package under `~600 KB`. |

## 2. Licensing & Compliance Notes

1. **Skill License:** This skill package (`unbroken-motion`) is released under the MIT License (`LICENSE`).
2. **Remotion License (Last verified: 2026-11-14):** Remotion is source-available under the Remotion License (`https://www.remotion.dev/license`). Free for individuals, non-profits, and companies with $\le 3$ people; a paid company license is required for commercial entities with 4 or more people. Always verify current terms before commercial client work.
3. **Fonts:** Use system-safe or OFL-licensed fonts (e.g., Inter, JetBrains Mono, Instrument Serif, Segoe UI, Georgia) and log font licenses in each film's `<workspace>/<film>/CREDITS.md`.
4. **Audio & SFX:** `scripts/synth-sfx.mjs` synthesizes 100% original 48 kHz PCM WAV files mathematically from oscillators and filtered noise (CC0 / public domain equivalent) into `<workspace>/.cache/sfx`. Any third-party music stems added to a project must be logged in `<workspace>/<film>/CREDITS.md`.
5. **Clean-Room Rule:** All motion math, camera solvers, carry helpers, reference manuals, and benchmark films in this skill are authored from scratch.
