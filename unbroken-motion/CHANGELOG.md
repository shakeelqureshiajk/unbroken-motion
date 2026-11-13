# Changelog

All notable changes to the `unbroken-motion` skill are documented in this file.

## [0.2.0] - 2026-11-14

### Added
- **Environment Diagnostics (`scripts/doctor.mjs`):** Validates Node.js version (`>= 22.6.0`), native TypeScript import support, skill package completeness, workspace write permissions and free disk space, Remotion renderer packages, and cross-platform FFmpeg/FFprobe binaries. Reports Tier 1 (full pipeline) vs Tier 2 (author-only mode).
- **Cross-Agent Installer (`scripts/install.mjs` & `agents.config.json`):** Detects and installs clean file copies (never symlinks) into Claude Code (`.claude/skills`), Google Antigravity (`.agents/skills` / `~/.gemini/antigravity/skills`), OpenAI Codex (`.codex/skills`), Cursor (`.cursor/skills`), OpenCode, and Amp with `--scope user|project`, `--update`, `--dry-run`, and `--uninstall`.
- **Clean Packaging Script (`scripts/package-skill.mjs`):** Builds a portable POSIX-path `unbroken-motion.zip` (`~200 KB`) with `unbroken-motion/` as the single top-level directory and zero binary/build bloat.
- **Additional Showcase Examples (`examples/`):** Added `04-agentic-ai` (`agentic-ai` brand, `16:9`, `12.8s`) and `05-content-creation` (`content-studio` brand, `9:16`, `15.0s`).
- **MIT `LICENSE` & `.gitignore`:** Included at the root of the skill package.

### Changed
- **Strictly Read-Only Skill Package at Runtime:** Replaced `<skill>/cases` and `<skill>/assets/sfx` with `resolveWorkspaceDir()` (`./unbroken-motion-films` or `UNBROKEN_MOTION_WORKSPACE`) and `resolveSfxDir()` (`<workspace>/.cache/sfx`). Running `scaffold.mjs`, `manifest.mjs`, `verify.mjs`, `render.mjs`, `sound.mjs`, `stills.mjs`, or `test-suite.mjs` never writes or modifies any file inside `SKILL_ROOT` (enforced by an automated snapshot assertion in `test-suite.mjs`).
- **De-duplicated Slim `examples/`:** Replaced full duplicate case folders (`8.8 MB`) with slim `examples/<slug>/{beats.json, src/scene.ts, src/brand.json}` (`~525 KB` uncompressed total skill size). `templates/starter/src` is now the single source of truth for `lib/`, `stage/`, and `compositions/`.
- **Zero-Symlink Dependency Sharing:** Removed Windows junctions and POSIX symlinks from `scaffold.mjs`. Installing `node_modules` once in `<workspace>` shares Remotion across all films in `<workspace>/<film-slug>` via standard Node.js parent-directory lookup.
- **Cross-Platform Compositor Lookup:** Updated `resolveFfmpegBinaries()` in `common.mjs` to resolve `@remotion/compositor-<platform>-<arch>` across `win32`, `darwin`, and `linux` (`x64`, `arm64`, `gnu`, `musl`).
- **Agent-Neutral `SKILL.md` & Relative Links:** Removed agent-specific file-reading tool names and local absolute URI paths across `SKILL.md` and `README.md`, and documented Tier 1 / Tier 2 runtime expectations.

## [0.1.0] - 2026-11-13

### Added
- Initial architecture and build of the `unbroken-motion` skill.
- Complete reference suite (`principles.md`, `rhythm.md`, `camera.md`, `carry-patterns.md`, `ui-rebuild.md`, `sound.md`, `rejected-cuts.md`).
- Strictly isolated multi-brand token system (`_template.md`, `obsidian-tech.md`, `warm-editorial.md`) validated by `brand.schema.json`.
- Deterministic Remotion starter template (`Stage`, `CameraRig`, `Actor`, `useContinuousFrame`, seeded `noise.ts`, analytical `easing.ts`, `camera.ts`, `carry.ts`, `blur.ts`, vector `ui-kit.tsx`, `Gallery.tsx`).
- JSON Schema Draft 2020-12 definitions (`beats.schema.json`, `brand.schema.json`).
- Automated pipeline scripts: `scaffold.mjs`, `manifest.mjs`, `verify.mjs` (Gates G1–G7), `stills.mjs` (annotated contact sheets), `synth-sfx.mjs` (procedural WAV synthesis), `sound.mjs` (reverb, side-chain ducking, -14 LUFS normalization), and `render.mjs` (1080p30 draft & 4K60 supersampled final).
- Calibration test suite (`_calibration-bad-slideshow`, `_calibration-good-carry`) and three benchmark films (`01-single-seed`, `02-ui-workflow`, `03-brand-reel-vertical`).

### Hardened & Verified
- Replaced FFmpeg filter/seek/rawvideo container dependencies incompatible with bundled Chromium FFmpeg via pure-Node audio DSP (`dsp.mjs` stereo reverb, sidechain ducking, BS.1770 LUFS/dBTP metering + `-f wav` decoding) and streaming AVI `bgr24` + `image2pipe` fixed-point temporal supersampling with stream backpressure (`render.mjs`).
- Switched `stills.mjs` default tile extraction to exact-frame Remotion `renderStill` snapshots so green/cyan manifest overlays match rendered pixels identically across fast boundary frames (`RC-007`).
- Enforced `-1.85 dB` PCM mastering ceiling and `256k` AAC muxing (`sound.mjs`) so encoded `.mp4` streams stay strictly `<= -1.0 dBTP` (`RC-006`).
- Logged `[RC-003]` through `[RC-007]` in `references/rejected-cuts.md` and promoted hardened continuity, framing, audio, and visual audit rules into `SKILL.md`.
