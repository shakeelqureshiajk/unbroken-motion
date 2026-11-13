# Unbroken Motion (`v0.2.0`)

**A deterministic, single-camera Remotion skill for producing unbroken product launch films, UI demos, kinetic typography teasers, and brand reels with zero hard cuts.**

Every beat physically grows out of the previous one using continuous spatial handoffs (`carry`), single-camera trajectory solving, rebuilt vector UI actors, procedural CC0 audio, and automated visual + quantitative verification (`G1`â€“`G7`).

---

## Core Philosophy

1. **Zero Hard Cuts (`carryScore = 1.0`):** Every beat boundary shares an active, transforming `<Actor>` across a centered `handoff.windowSec` using one of five physical carry modes:
   - `morph` â€” one form continuously reshapes into another (e.g., dot seed -> command bar).
   - `tether` â€” an anchor element travels along a physical bridge while the camera pans.
   - `detach` â€” a UI sub-element lifts out of a list or shell to become the next beat's hero.
   - `portal` â€” the camera pushes through an expanding frame directly into the next view.
   - `collapse` â€” an expanded layout folds back cleanly into a badge or signature mark.
2. **One Continuous Camera:** Camera presets (`follow`, `whip`, `pushThrough`, `float`, `shake`, `hold`) blend smoothly across boundaries using logarithmic zoom interpolation and seeded simplex drift.
3. **3-Layer Vector UI Rebuilds:** Never pan or zoom static screenshots. Hero UI elements are rebuilt from resolution-independent components in [`templates/starter/src/lib/ui-kit.tsx`](unbroken-motion/templates/starter/src/lib/ui-kit.tsx) with a clean shell, semantic content, and a kinetic hero anchor.
4. **Pure-Function Determinism:** Frame states depend strictly on `useContinuousFrame()` (`frame + shutterOffset`) and an explicit integer `seed`â€”never `Math.random()`, `Date.now()`, or raw `useCurrentFrame()`. Identical evaluation powers both React/Remotion rendering and Node telemetry generation.
5. **Read-Only Skill & Gatekeeping:** The installed skill directory is 100% read-only at runtime. All films, manifests, audio caches, and `node_modules` live in your workspace (`./unbroken-motion-films/<film-slug>` or `UNBROKEN_MOTION_WORKSPACE`). No draft is shown and no `--final` 4K60 master renders unless all 7 automated gates (`G1`â€“`G7`) pass and annotated diagnostic contact sheets (`boundary-handoffs.png`, `beat-overview.png`) are inspected.

---

## Support Tiers & Requirements

| Tier | Environment | Capabilities |
| --- | --- | --- |
| **Tier 1 (Full Pipeline)** | Local terminal on Windows, macOS, or Linux (`x64` / `arm64`) â€” **Claude Code, Google Antigravity, OpenAI Codex CLI, Cursor, OpenCode, Amp** | Full automated pipeline: `doctor`, `scaffold`, `<100ms` `manifest` + `G1`â€“`G7` verification, 1080p30 draft renders (`~10â€“15s`), contact sheet generation, procedural CC0 audio mastering, and 4K60 4-pass supersampled master renders (`~2â€“4 min` for a 12s film). |
| **Tier 2 (Author-Only Mode)** | Hosted web/desktop sandbox without local Chromium or network â€” **Claude Desktop, Claude.ai Web** | Concept pitching, authoring `beats.json` and `src/scene.ts`, and schema/continuity logic review; outputs exact CLI commands for the user to render locally. |

### Runtime Prerequisites (Tier 1)
- **Node.js `>= 22.6.0`** (LTS `22.18+` or `24+` recommended; uses native TypeScript type-stripping so `manifest.mjs` evaluates `src/scene.ts` in `< 100ms` with zero build step).
- **Network access (first workspace setup only):** Required once when running `npm install` in the film workspace (`./unbroken-motion-films`) to install Remotion, Chromium Headless Shell, and bundled FFmpeg.

---

## Skill Package Structure

```text
unbroken-motion/
â”œâ”€â”€ SKILL.md                            # Core agent instructions & hard rules (agent-neutral)
â”œâ”€â”€ README.md                           # Documentation & cross-agent install guide
â”œâ”€â”€ DECISIONS.md                        # Architectural ADRs & licensing log
â”œâ”€â”€ CHANGELOG.md                        # Version history & hardened rules log
â”œâ”€â”€ LICENSE                             # MIT License
â”œâ”€â”€ agents.config.json                  # Target paths for Claude, Antigravity, Codex, Cursor, OpenCode, Amp
â”œâ”€â”€ references/
â”‚   â”œâ”€â”€ principles.md                   # Core motion & continuity manifesto
â”‚   â”œâ”€â”€ rhythm.md                       # Asymmetric timing & rest-ratio rules
â”‚   â”œâ”€â”€ camera.md                       # Continuous camera presets & curves
â”‚   â”œâ”€â”€ carry-patterns.md               # Morph, tether, detach, portal, collapse specs
â”‚   â”œâ”€â”€ ui-rebuild.md                   # 3-layer vector UI architecture
â”‚   â”œâ”€â”€ sound.md                        # SFX synthesis, reverb, ducking, -14 LUFS mastering
â”‚   â”œâ”€â”€ rejected-cuts.md                # Logged failures promoted to G1-G7 & SKILL.md rules
â”‚   â””â”€â”€ brands/
â”‚       â”œâ”€â”€ _template.md                # Starter template for new brands
â”‚       â”œâ”€â”€ obsidian-tech.md            # Dark slate/cyan/indigo tech brand ("VECTRA")
â”‚       â”œâ”€â”€ warm-editorial.md           # Sunlit linen/terracotta editorial brand ("ATELIER")
â”‚       â”œâ”€â”€ agentic-ai.md               # Dark cyan/teal AI explainer brand ("AGENTIC AI")
â”‚       â””â”€â”€ content-studio.md           # Warm editorial creator brand ("CREATOR")
â”œâ”€â”€ schema/
â”‚   â”œâ”€â”€ beats.schema.json               # JSON Schema Draft 2020-12 for beat sheets
â”‚   â””â”€â”€ brand.schema.json               # JSON Schema Draft 2020-12 for brand tokens
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ common.mjs                      # Workspace/SFX resolvers, brand loader, schema validator, FFmpeg lookup
â”‚   â”œâ”€â”€ doctor.mjs                      # Environment & Tier 1/Tier 2 readiness checker
â”‚   â”œâ”€â”€ install.mjs                     # Multi-agent copy installer (never symlinks)
â”‚   â”œâ”€â”€ package-skill.mjs               # Builds clean POSIX-path unbroken-motion.zip
â”‚   â”œâ”€â”€ scaffold.mjs                    # Scaffolds new films in <workspace>/<film-slug>
â”‚   â”œâ”€â”€ manifest.mjs                    # Evaluates per-frame screenBoxes & velocities (manifest.json)
â”‚   â”œâ”€â”€ verify.mjs                      # Automated G1-G7 gate checker
â”‚   â”œâ”€â”€ stills.mjs                      # Exact-frame Remotion DiagnosticSheet contact sheets
â”‚   â”œâ”€â”€ synth-sfx.mjs                   # Procedural 48kHz CC0 WAV SFX generator
â”‚   â”œâ”€â”€ dsp.mjs                         # Pure-Node reverb, sidechain ducking, LUFS & True Peak DSP
â”‚   â”œâ”€â”€ sound.mjs                       # Audio stem mixing, -1.85 dB mastering, & MP4 AAC muxing
â”‚   â”œâ”€â”€ render.mjs                      # Draft (1080p30), Gallery, & 4K60 4-pass supersampled final
â”‚   â””â”€â”€ test-suite.mjs                  # End-to-end negative, brand-switch, calibration, & read-only tests
â”œâ”€â”€ templates/starter/                  # Single source of truth for Remotion runtime (lib/, stage/, compositions/)
â””â”€â”€ examples/                           # Slim benchmark & calibration films (beats.json + src/scene.ts + src/brand.json)
```

---

## Installation Across Agents

### Automatic Multi-Agent Installer (Recommended)
Run `install.mjs` to auto-detect installed agents on your machine and copy (never symlink) the skill into their skill directories:

```bash
# Auto-detect installed agents (user-level global install)
node scripts/install.mjs

# Install or update for a specific agent (claude | antigravity | codex | cursor | opencode | amp | all)
node scripts/install.mjs --agent all --scope user --update

# Install into a specific project workspace
node scripts/install.mjs --agent claude,antigravity,codex --scope project --project-dir /path/to/project
```

### Manual Installation by Agent

1. **Claude Code:**
   - **Global:** Copy `unbroken-motion/` to `~/.claude/skills/unbroken-motion` (`$HOME\.claude\skills\unbroken-motion` on Windows).
   - **Project:** Copy to `<project>/.claude/skills/unbroken-motion`.
2. **Google Antigravity:**
   - **Global:** Copy `unbroken-motion/` to `~/.gemini/antigravity/skills/unbroken-motion`.
   - **Project:** Copy to `<project>/.agents/skills/unbroken-motion`.
3. **OpenAI Codex CLI:**
   - **Global:** Copy `unbroken-motion/` to `~/.codex/skills/unbroken-motion`.
   - **Project:** Copy to `<project>/.codex/skills/unbroken-motion`.
4. **Cursor / OpenCode / Amp:**
   - Copy `unbroken-motion/` to `<project>/.cursor/skills/unbroken-motion`, `~/.config/opencode/skills/unbroken-motion`, or `~/.amp/skills/unbroken-motion`.
5. **Claude Desktop / Claude.ai Web (`.zip`):**
   - Build or download `unbroken-motion.zip` (`node scripts/package-skill.mjs`) and upload it via **Settings -> Capabilities -> Skills**.

### Verify Installation
1. Restart your agent session so it reloads discovered skills.
2. Ask the agent: *"What skills do you have available?"* and confirm `unbroken-motion` appears.
3. Run the environment check:
   ```bash
   node <skill-dir>/scripts/doctor.mjs
   ```

---

## Quickstart & CLI Workflow

All generated films are stored outside the skill folder in `./unbroken-motion-films/<film-slug>` (or the directory set in `UNBROKEN_MOTION_WORKSPACE`).

### 0. Check Environment Readiness
```bash
node scripts/doctor.mjs
```

### 1. Scaffold a New Film in Your Workspace
```bash
node scripts/scaffold.mjs --name product-launch --brand obsidian-tech --aspect 16:9 --install
```
- Supported aspect ratios: `16:9` (`1920x1080` draft / `3840x2160` final), `9:16` (`1080x1920` / `2160x3840`), `1:1` (`1080x1080` / `2160x2160`).
- You can also scaffold starting from any bundled example with `--from-example 01-single-seed`.
- Passing `--install` runs `npm install` once at the workspace root (`./unbroken-motion-films/node_modules`), so all films in that workspace share dependencies automatically via standard Node.js parent-directory lookup without symlinks.

### 2. Author `beats.json` & Pure Scene Motion (`src/scene.ts`)
Edit `./unbroken-motion-films/product-launch/beats.json` and `./unbroken-motion-films/product-launch/src/scene.ts`. Validate schema and topology immediately:
```bash
node scripts/verify.mjs --film product-launch --schema-only
```

### 3. Fast Metric Pre-Flight (`< 100ms`, No Browser Needed)
Generate frame telemetry and verify `G1`â€“`G5` + `G7` before rendering pixels:
```bash
node scripts/manifest.mjs --film product-launch && node scripts/verify.mjs --film product-launch
```

### 4. Draft Render, Audio Mix, & Diagnostic Stills (`~10â€“15s`)
```bash
node scripts/render.mjs --film product-launch --draft
```
Produces:
- `out/draft.mp4` (`30fps` + directional velocity blur + mastered `-14 LUFS` AAC audio)
- `stills/boundary-handoffs.png` & `stills/beat-overview.png` (exact-frame Remotion diagnostic contact sheets)
- Full `G1`â€“`G7` verification report

### 5. 4K60 Temporal Supersampled Master (`~2â€“4 min`)
Refuses to run unless all gates pass:
```bash
node scripts/render.mjs --film product-launch --final --blur-samples 4
```

### 6. Full Automated Regression Suite
```bash
node scripts/test-suite.mjs
```

---

## Verification Gates (`G1`â€“`G7`)

| Gate | Name | Pass Criteria |
| --- | --- | --- |
| **G1** | Schema & Carry Topology | Valid `beats.schema.json` + `brand.schema.json`, contiguous `start + duration` timeline, valid carry graph, `windowSec <= 0.5 * min(b0.duration, b1.duration)` |
| **G2** | Boundary Continuity | Across `[fb-4 .. fb+4]`: `opacity >= 0.35`, velocity-compensated `IoU >= 0.55`, per-frame `areaRatio <= 1.25`, centroid jump `<= max(36, 1.35 * localVel1080)`, active motion cheat check (`Î”pos > 24px` or `Î”scale > 15%`), `carryScore = 1.0` |
| **G3** | Rhythm & Pacing | Beat duration range `max/min >= 2.8`, duration CV `>= 0.28`, rest frames (`speed < 1.5 px/f`) in `[15%, 45%]`, and `>= 8` settle frames `< 3.0 px/f` within `15` frames after any `> 28 px/f` burst |
| **G4** | Framing & Safe Zone | Resting hero actors (`speedNorm < 14`) stay within the `90%` viewport safe zone (`portal` exempted after `areaRatio > 0.65`) |
| **G5** | Velocity Motion Blur | Any camera or visible actor with `speedNorm > 20` has active velocity blur (`blurEnabled && blurStrength > 0`) |
| **G6** | Audio Integrity | Integrated loudness within `-14 +/- 2 LUFS` (`[-16.5, -11.5]`), True Peak `<= -1.0 dBTP` on the muxed `.mp4` AAC stream, and transient RMS alignment on declared events |
| **G7** | Brand Isolation & Determinism | Zero unauthorized/forbidden colors, no hardcoded hex/rgb literals in `src/scene.ts`, and zero `Math.random()`, `Date.now()`, or raw `useCurrentFrame()` calls |

---

## Bundled Slim Examples (`examples/`)

- `_calibration-bad-slideshow` â€” Intentional hard-cut / flat-rhythm fixture; verifies `G2` (`carryScore = 0`) and `G3` fail cleanly.
- `_calibration-good-carry` â€” Reference single-carry continuity fixture; verifies `carryScore = 1.0`.
- `smoke-test` â€” Starter seed (`morph` + `collapse`) + `Gallery` showcase.
- `01-single-seed` â€” `obsidian-tech`, `16:9`, `12.60s`: full arc spanning `morph`, `tether`+`whip`, `portal`+`pushThrough`, and `collapse`.
- `02-ui-workflow` â€” `obsidian-tech`, `16:9`, `12.80s`: Layer-1 `appWindow` + vector `cursor` click + `menuRow` `detach` into `chip` inside `commandBar` -> `tether` -> `portal` into 3-card telemetry dashboard -> `collapse`.
- `03-brand-reel-vertical` â€” `warm-editorial`, `9:16` (`1080x1920`), `12.40s`: vertical mobile launch reel using vertical `tether` into `phoneFrame`, stacked editorial cards, and `ATELIER` resolve.
- `04-agentic-ai` â€” `agentic-ai`, `16:9`, `12.80s`: Agentic AI explainer (goal detach -> plan -> tool-call tether -> perceive/reason/act dashboard -> collapse).
- `05-content-creation` â€” `content-studio`, `9:16`, `15.00s`: Content Creation reel (idea seed -> script bar -> recording phone -> shoot/edit/publish cards -> `CREATOR` resolve).

---

## Licensing

- **Skill Package (`unbroken-motion`):** Released under the [MIT License](LICENSE).
- **Procedural Audio (`synth-sfx.mjs`):** Synthesized mathematically at 48 kHz (CC0 / public domain equivalent).
- **Remotion Runtime:** Remotion v4 is governed by the [Remotion License](https://www.remotion.dev/license) (free for individuals, non-profits, and companies with $\le 3$ people; commercial license required for larger organizations).

