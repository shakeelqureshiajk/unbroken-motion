# Rhythm, Pacing, and Rest Architecture

Great motion feels musical because it alternates tension (acceleration, scale shifts, kinetic bridges) with release (holds, readable UI settles). This manual defines the quantitative pacing rules enforced by **Gate G3** in `scripts/verify.mjs`.

---

## 1. The Four Pacing Metrics (Gate G3)

For a film with beat durations $d_1, d_2, \dots, d_n$ (in seconds):

1. **Duration Dynamic Range (G3.1):**
   $$\frac{\max_i(d_i)}{\min_i(d_i)} \ge 2.8 \quad (\text{when } n \ge 3)$$
   Ensures at least one snappy kinetic beat and one unhurried showcase beat exist in the same cut.

2. **Duration Coefficient of Variation (G3.2):**
   $$\text{CV} = \frac{\sigma_d}{\mu_d} \ge 0.28$$
   Prevents clusters of nearly-identical beat durations (e.g., `[2.0, 2.1, 2.2, 1.9]` has $\text{CV} \approx 0.05$).

3. **Global Rest Ratio (G3.3):**
   Define a frame $f$ as a **rest frame** when both camera speed and hero actor speed (normalized to 1080p30 pixel-per-frame units) are calm:
   $$\|\mathbf{v}_{\text{cam}}(f)\| < 1.5\text{ px/f} \quad \land \quad \|\mathbf{v}_{\text{hero}}(f)\| < 1.5\text{ px/f}$$
   Target range:
   $$15\% \le \frac{\text{restFrames}}{\text{totalFrames}} \le 45\%$$
   - Below $15\%$: viewer suffers visual fatigue and cannot read labels.
   - Above $45\%$: film stalls into an animated slide deck.

4. **Post-Impulse Settle Window (G3.4):**
   Whenever any burst reaches high speed ($\|\mathbf{v}_{\text{cam}}\| > 28\text{ px/f}$ or $\|\mathbf{v}_{\text{hero}}\| > 28\text{ px/f}$), a readable settle window of **at least 8 consecutive low-velocity frames** ($\|\mathbf{v}\| < 3.0\text{ px/f}$) must begin within **15 frames** after the burst subsides (unless the film ends within that window).

---

## 2. Canonical Beat Archetypes

Mix these four beat lengths when authoring `beats.json`:

| Beat Archetype | Typical Duration | Purpose | Camera Behavior |
|---|---|---|---|
| **Spark / Hook** | `0.9s – 1.4s` | Instant visual premise (dot appears, cursor snaps, pulse fires) | `hold` $\to$ `morph` |
| **Kinetic Bridge** | `1.0s – 1.6s` | Carry attention from location A to location B | `whip` or `follow` |
| **Feature Showcase** | `3.2s – 5.0s` | Reader absorbs rebuilt UI, interaction occurs, badge updates | `hold`/`float` $\to$ `detach` or `pushThrough` |
| **Resolve / End Mark** | `1.8s – 2.6s` | Multi-element collapse into brand mark + crisp tagline | `collapse` $\to$ `hold` |

### Example 12-Second Rhythm Curve (5 Beats)
`[1.2s Spark] → [3.6s Showcase A] → [1.1s Whip Bridge] → [3.9s Showcase B] → [2.2s Brand Resolve]`
- $\max/\min = 3.9 / 1.1 = 3.55 \ge 2.8$ (PASS)
- $\mu = 2.40\text{s}$, $\sigma = 1.17\text{s}$, $\text{CV} = 0.49 \ge 0.28$ (PASS)
- Rest windows sit naturally inside Showcase A (`~1.2s`), Showcase B (`~1.3s`), and Brand Resolve (`~1.0s`) $\implies \sim 29\%$ global rest (PASS).

---

## 3. Easing Curves & Settle Timing (`lib/easing.ts`)

Choose curve presets deliberately based on visual mass:

| Preset | Physics / Curve | Peak Normalized Velocity | Effective Settle Time | Best Used For |
|---|---|---|---|---|
| `snappy` | Crit-damped spring ($\zeta \approx 0.92, \omega_n \approx 18$) | High early punch (`~2.4/s`) | `~0.42s` | Command bar expansion, chip docking, button click |
| `soft` | Overdamped cubic/spring ($\zeta \approx 1.05, \omega_n \approx 11$) | Gentle bell (`~1.5/s`) | `~0.65s` | Warm editorial UI reveals, subtle card elevation |
| `heavy` | High-mass spring ($\zeta \approx 0.98, \omega_n \approx 9$) | Authoritative glide (`~1.3/s`) | `~0.85s` | Full app window push-throughs, portal entries |
| `overshoot` | Underdamped spring ($\zeta \approx 0.68, \omega_n \approx 16$) | Snappy + 6% rebound | `~0.58s` | Playful badge pops, tactile cursor detents |
| `whipQuart` | Asymmetric Quartic In-Out ($p=4$) | Sharp midpoint spike (`~3.1/s`) | `~0.45s` | `whip` camera pans along tethers |

---

## 4. Velocity Normalization Across Resolutions & Frame Rates

Gate G3 and Gate G5 normalize every speed measurement to a **1080p @ 30fps baseline** so thresholds work identically for `16:9` 1080p30, `9:16` 1080x1920, and `4K60`:

$$v_{\text{norm}} = v_{\text{px/frame}} \times \left(\frac{1920}{\max(W, H)}\right) \times \left(\frac{\text{fps}}{30}\right)$$

Always design beat handoff durations in **seconds** (`windowSec`), never hardcoded frame counts, so changing `fps` from `30` (`--draft`) to `60` (`--final`) preserves exact real-world rhythm.
