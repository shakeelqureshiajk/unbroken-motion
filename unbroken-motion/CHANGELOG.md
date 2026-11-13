# Changelog

All notable changes to the `unbroken-motion` skill are documented in this file.

## [0.1.0] - 2026-11-13

### Added
- Initial architecture and build of the `unbroken-motion` Antigravity skill.
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
