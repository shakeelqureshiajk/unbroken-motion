# Rejected Cuts & Hardened Rules Log (`references/rejected-cuts.md`)

Every visual flaw discovered during calibration, benchmark creation, or human review is logged here and converted into **both** an automated check in `scripts/verify.mjs` and a concise entry under **Hard Rules** in `SKILL.md`.

---

## Entry Template

```markdown
### [RC-XXX] Short Title
- **Date:** YYYY-MM-DD
- **Film / Beat:** `<film-slug>` (`b2 -> b3`)
- **What Failed Visually:** Describe what looked wrong in `boundary-handoffs.png` or draft MP4.
- **Root Cause:** Explain the underlying math, timing, or layout bug.
- **Metric / Guard Added:** Describe the quantitative assertion added to `verify.mjs` or `schema/`.
- **Hard Rule Promoted:** Copy the exact one-line rule added to `SKILL.md`.
```

---

## Initial Baseline Guardrails (Pre-Benchmark Calibration)

### [RC-001] Static Watermark Faking Continuity
- **Date:** 2026-11-13
- **Film / Beat:** Architecture Review (Synthetic Test)
- **What Failed Visually:** A slideshow cut hard between two unrelated cards while an unmoving corner brand mark stayed visible, tricking naive "shared ID on both sides" logic into reporting 100% carry.
- **Root Cause:** Checking only actor ID presence and bounding-box IoU across a boundary allows zero-motion overlays to pass as carried anchors.
- **Metric / Guard Added:** Gate G2.4 (**Anti-Static Cheat**): requires the carried actor to undergo $\Delta \text{pos} > 24\text{ px}$ or $\Delta \text{scale} > 15\%$ across `handoff.windowSec`.
- **Hard Rule Promoted:** *"Carried elements must actively transform or move across the handoff window; static logos/backgrounds cannot count as carries."*

### [RC-002] Portal Push-Through Tripping Safe-Zone Framing
- **Date:** 2026-11-13
- **Film / Beat:** Architecture Review (`pushThrough` design)
- **What Failed Visually:** Valid portal transitions where the camera zooms through an app frame naturally push the frame borders outside the 90% viewport safe zone, causing false-positive framing failures.
- **Root Cause:** Applying static safe-zone containment identically to resting hero actors and expanding portal boundaries.
- **Metric / Guard Added:** Gate G4 explicitly exempts actors executing `mode: "portal"` once their projected bounding-box area exceeds `65%` of the viewport area.
- **Hard Rule Promoted:** *"Keep resting hero actors inside the 90% safe zone; exempt portal actors only after passing 65% viewport coverage."*

---

## Observed Calibration & Benchmark Rejections

### [RC-003] Over-Damped Spring Curves Exceeding Post-Impulse Settle Window
- **Date:** 2026-11-13
- **Film / Beat:** `smoke-test` (`b1-spark -> b2-command`)
- **What Failed Visually:** Fast spring arrivals left trailing residual drift above `3.0 px/frame` deep into the supposed reading hold, starving the beat of a clean visual settle.
- **Root Cause:** Fixed exponential tail constants in spring/overshoot curves did not map completely across `effectiveSettleSec`, leaving velocity nonzero when the handoff window opened.
- **Metric / Guard Added:** `evaluateCurve` in `src/lib/easing.ts` maps normalized progress across `effectiveSettleSec` cleanly, enforced by Gate G3.4 (`>= 8` low-velocity frames `< 3.0 px/f` starting within 15 frames of any `>28 px/f` impulse).
- **Hard Rule Promoted:** *"Map settle/overshoot easing strictly across `effectiveSettleSec` so post-impulse velocity drops below `1.5 px/f` inside every settle dwell."*

### [RC-004] Cross-Beat Camera Blending Querying Out-of-Lifespan Actor Positions
- **Date:** 2026-11-13
- **Film / Beat:** `smoke-test` (`b2-command -> b3-resolve`)
- **What Failed Visually:** During the cross-beat transition blend window, the camera snapped partially toward stage origin `(0, 0)` instead of smoothly holding the outgoing actor's departure coordinates.
- **Root Cause:** `getBeatBasePose` sampled `resolveTarget(beat.camera.target, timeSec)` past an outgoing actor's mount lifespan or before an incoming actor spawned, hitting the `(0, 0)` fallback.
- **Metric / Guard Added:** `camera.ts` clamps `sampleT` into `[beat.start + 0.02, beat.start + beat.duration - 0.02]`, and Gate G2 enforces centroid jump `< max(36, 1.35 * v)` on all boundary frames.
- **Hard Rule Promoted:** *"Clamp camera target resolution inside each beat's active lifespan so transition blends never sample despawned actors."*

### [RC-005] Whip Pan Coupled With Simultaneous Large Area Scaling / Short Travel Axis
- **Date:** 2026-11-13
- **Film / Beat:** `03-brand-reel-vertical` (`b2-caption -> b3-whip-phone`)
- **What Failed Visually:** On a vertical `9:16` whip pan, a short-height `tetherOrb` stretched less than one frame's camera displacement, causing an optical gap and exceeding velocity-compensated centroid tolerances (`54.5px > 54.3px`, `IoU 0.29 < 0.55`).
- **Root Cause:** Scaling or short-axis capsules paired directly with fast `whipQuart` camera translation create high concavity between finite-difference velocity and frame-to-frame centroid displacement.
- **Metric / Guard Added:** Gate G2 asserts `IoU >= 0.55`, `areaRatio <= 1.25`, and centroid jump limits on both horizontal `16:9` and vertical `9:16` whips; large-ratio morphs use log-space `interpolateWorldBox` with `soft` easing.
- **Hard Rule Promoted:** *"Never combine large area growth (`>3x`) with fast whip pans; orient tether anchors along the whip axis and interpolate area in log-space."*

### [RC-006] Lossy AAC Quantization Pushing Inter-Sample True Peak Above `-1.0 dBTP`
- **Date:** 2026-11-13
- **Film / Beat:** `01-single-seed` (`draft.mp4` AAC mix)
- **What Failed Visually:** PCM master WAV peaked cleanly at `-1.19 dBTP`, yet the muxed `.mp4` AAC stream clipped up to `-0.74 dBTP` due to perceptual transform ringing, while Remotion's bundled FFmpeg lacked `-f f32le` for pipe inspection.
- **Root Cause:** Limiter sample ceiling `-1.35 dB` left insufficient inter-sample headroom for lossy `192k` AAC encoding, and only testing WAV masked MP4 peaks.
- **Metric / Guard Added:** `scripts/sound.mjs` enforces `-1.85 dB` PCM ceiling + `256k` AAC encoding; `scripts/dsp.mjs` decodes `.mp4` streams via `-f wav pcm_s16le` so Gate G6 measures true `-1.0 dBTP` compliance on the actual delivered `.mp4`.
- **Hard Rule Promoted:** *"Master WAV at `-1.85 dB` ceiling (`256k` AAC) and verify Gate G6 directly against the muxed `.mp4` audio stream (`<= -1.0 dBTP`)."*

### [RC-007] H.264 Keyframe Seek Drift Misaligning Diagnostic Contact Sheet Overlays
- **Date:** 2026-11-13
- **Film / Beat:** `smoke-test` (`boundary-handoffs.png` @ `f29`, `f31`)
- **What Failed Visually:** Visual review of `boundary-handoffs.png` caught the rendered `seedDot` pixel pill lagging slightly left of its green manifest bounding box on fast-moving pre-boundary frames.
- **Root Cause:** `ffmpeg -ss` seeking on H.264 MP4 drifted by `-1` frame near non-IDR frames relative to `manifest.json` frame indices.
- **Metric / Guard Added:** `scripts/stills.mjs` extracts bit-exact frame PNGs directly via Remotion `renderStill` against the `Film` composition, guaranteeing exact pixel-to-manifest parity during visual audits.
- **Hard Rule Promoted:** *"Extract diagnostic contact sheet tiles with exact Remotion frame renders (not MP4 `-ss` seeks) before performing visual boundary review."*
