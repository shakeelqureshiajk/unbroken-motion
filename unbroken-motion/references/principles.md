# Core Principles of Unbroken Motion

Every film produced by `unbroken-motion` obeys six non-negotiable engineering and cinematic laws. Aesthetics are never left to chance: every law maps directly to a mathematical invariant and an automated gate in `scripts/verify.mjs`.

---

## 1. Carry (Continuous Object Handoff)

- **Definition:** At every boundary between two beats $b_i \to b_{i+1}$, at least one visible `<Actor>` from beat $b_i$ survives across the transition window and physically transforms into the spatial anchor of beat $b_{i+1}$. Scenes never cut, cross-dissolve, or wipe onto an unrelated screen.
- **Mathematical Invariant:**
  Across boundary frames $[f_b - 3, f_b + 3]$:
  - Opacity of the carried actor stays $\ge 0.35$.
  - Adjacent-frame centroid jump $\|\mathbf{p}(f) - \mathbf{p}(f-1)\| \le \max(36\text{ px}, 1.35 \cdot \|\mathbf{v}_{\text{local}}\|)$.
  - Adjacent-frame area ratio $\max(A_f / A_{f-1}, A_{f-1} / A_f) \le 1.25$ and velocity-compensated $\text{IoU} \ge 0.55$.
  - **Anti-static cheat:** Across `handoff.windowSec`, the carried actor must undergo a genuine transformation ($\Delta \text{pos} > 24\text{ px}$ or $\Delta \text{scale} > 15\%$); a static corner logo cannot count as a carry.
- **Do:**
  1. Morph a pulsing seed dot (`w: 28, h: 28, r: 14`) smoothly into a rounded command bar (`w: 760, h: 72, r: 18`) while keeping its center continuous.
  2. Detach a selected menu row out of a dropdown card, fly it along a curved arc, and dock it as an active filter chip inside an input box while the background card recedes.
- **Don't:**
  1. Fade Beat 1 (`opacity: 1 -> 0`) while fading Beat 2 (`opacity: 0 -> 1`)—that is a slideshow cross-dissolve, even if done quickly.
  2. Snap an icon at `(x: -300, y: 0)` instantaneously to `(x: 400, y: 120)` on frame $f_b$ without an interpolated path or tether.
- **Enforcing Gate:** **Gate G1** (valid `carryActor -> targetActor` chain) and **Gate G2** (Boundary Continuity & Anti-Static Check).

---

## 2. One Virtual Camera

- **Definition:** The entire film happens inside one unified 2.5D spatial stage observed by a single virtual camera rig `(x, y, zoom, roll)`. Motion cuts are replaced by motivated camera choreography: `follow`, `whip`, `pushThrough`, `float`, `shake`, and `hold`.
- **Mathematical Invariant:**
  The camera trajectory $\mathbf{C}(t) = (x(t), y(t), \ln z(t), \theta(t))$ is $C^0$-continuous everywhere and $C^1$-smooth except at deliberate trauma impacts (`shake`). Camera zoom always interpolates in log-space ($z_0 e^{k t}$) so perceived optical speed stays constant across scales.
- **Do:**
  1. Use `whip` to pan rapidly across a connecting tether beam from a source button to a destination analytics panel, scaling directional motion blur automatically with pan velocity.
  2. Use `pushThrough` (`portal` carry) to zoom exponentially into an app card until its inner canvas fills 100% of the viewport and reveals the next detail level.
- **Don't:**
  1. Reset camera `(x, y, zoom)` instantaneously back to `(0, 0, 1.0)` at the start of a new beat.
  2. Apply linear zoom interpolation (`1.0 -> 8.0`) over 1 second, which feels super-fast from `1x` to `2x` and stalls perceptually from `6x` to `8x`.
- **Enforcing Gate:** **Gate G2** (camera discontinuities immediately fail boundary centroid/area continuity) and **Gate G5** (high-speed camera moves require active motion blur).

---

## 3. Rests & Post-Impulse Settle

- **Definition:** Speed only registers as dramatic if surrounded by stillness. Every high-energy transition (`whip`, `pushThrough`, fast `morph`) must land cleanly into a calm rest window where viewers can actually read the UI and copy.
- **Mathematical Invariant:**
  - Global rest ratio: $15\% \le \text{pct}(\|\mathbf{v}_{\text{cam}}\| < 1.5\text{ px/f} \land \|\mathbf{v}_{\text{hero}}\| < 1.5\text{ px/f}) \le 45\%$.
  - Post-impulse settle: Every burst with $\|\mathbf{v}\| > 28\text{ px/f}$ must be followed within $15$ frames by at least $8$ consecutive low-velocity frames ($\|\mathbf{v}\| < 3\text{ px/f}$).
- **Do:**
  1. Land a fast `whip` into a clean 1.2s `hold` (with gentle $1\text{–}3\text{ px}$ seeded `float` breathing) while a headline chip locks into focus.
  2. Give a newly revealed dashboard card $0.5\text{ s}$ of calm readability before detaching the next hero element.
- **Don't:**
  1. Chain four consecutive `0.6s` whip-pans back-to-back with zero breathing room—the viewer experiences motion sickness and reads nothing.
  2. Freeze frames mathematically dead (`0.000 px` change for 3 seconds) without subtle breathing or micro-interaction unless intentional impact pause.
- **Enforcing Gate:** **Gate G3.3** (Global Rest Ratio) and **Gate G3.4** (Post-Impulse Settle).

---

## 4. Asymmetric Rhythm (No Metronome Pacing)

- **Definition:** Shot durations must follow musical tension and release rather than a repeating timer. Fast kinetic bridges contrast against lingering hero showcases.
- **Mathematical Invariant:**
  For any film with $\ge 3$ beats:
  - Dynamic range $\max(d_i) / \min(d_i) \ge 2.8$.
  - Coefficient of variation $\sigma_d / \mu_d \ge 0.28$.
- **Do:**
  1. Sequence beats as `[1.2s spark, 3.8s product reveal, 1.1s whip-bridge, 4.1s workflow hero, 2.3s resolve]`.
  2. Pair short micro-beats (`0.9s–1.3s`) with kinetic `tether` or `morph` transitions and long beats (`3.5s–5.0s`) with layered UI demonstrations.
- **Don't:**
  1. Build a 5-beat film with durations `[2.5, 2.5, 2.5, 2.5, 2.5]`.
  2. Make every beat nearly equal (`[2.0, 2.2, 1.9, 2.1]`), which reads like an automated PowerPoint deck.
- **Enforcing Gate:** **Gate G3.1** (Duration Dynamic Range) and **Gate G3.2** (Duration Coefficient of Variation).

---

## 5. Measured, Never Guessed

- **Definition:** Every aesthetic judgment is backed by deterministic telemetry (`manifest.json`), automated assertions (`verify.mjs`), and visual inspection of boundary contact sheets (`stills/boundary-handoffs.png`).
- **Mathematical Invariant:**
  All animation curves, camera rigs, and noise generators are pure functions of `(continuousFrame, fps, seed)`. No `Math.random()`, no `Date.now()`, no stateful React hooks (`useState` / `useEffect`) driving frame visuals.
- **Do:**
  1. Run `verify.mjs` after every draft render and inspect `boundary-handoffs.png` before calling audio or final export.
  2. Whenever visual inspection reveals a jarring frame that slipped past checks, document it in `rejected-cuts.md` and encode a new quantitative check in `verify.mjs`.
- **Don't:**
  1. Override `--final` over a failing continuity score hoping nobody notices in 4K.
  2. Use `Math.random()` for camera shake or floating particles, which breaks seek determinism and temporal supersampling.
- **Enforcing Gate:** **All Gates G1–G7** + mandatory `stills.mjs` visual self-check.

---

## 6. Hero-First Vector UI (Zero Screen Recordings)

- **Definition:** Screenshots are reference blueprints, never video layers. Product UI is reconstructed on the camera's plane as crisp, resolution-independent vector/DOM `<Actor>` components driven strictly by isolated brand tokens.
- **Mathematical Invariant:**
  Hero actors scale crisply under arbitrary camera zoom ($0.25\times$ to $12\times$) without raster scaling artifacts, and every rendered color, font family, and radius exists in the active `references/brands/<brand>.md` token table (`0` leaked hex values).
- **Do:**
  1. Rebuild UI in three fidelity tiers (*Shell → Context → Hero Vector Actors*) using `ui-kit.tsx` primitives.
  2. Keep copy concise (3–5 words per card, clean semantic metrics) so typography reads cleanly at mobile scale.
- **Don't:**
  1. Place a full-screen screenshot PNG inside a `<div style={{ transform: scale(4) }}>`—text blurs and individual rows cannot detach.
  2. Mix brand hex colors or fonts across projects.
- **Enforcing Gate:** **Gate G4** (Framing & Safe Zone) and **Gate G7** (Strict Brand Isolation & Static Code Audit).
