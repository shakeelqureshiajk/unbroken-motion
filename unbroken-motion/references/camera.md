# Virtual Camera Rig & Motion Physics (`lib/camera.ts`)

All compositions exist on a single unified stage observed by one continuous 2.5D virtual camera:

$$\mathbf{C}(t) = \bigl(x(t),\; y(t),\; z(t),\; \theta(t)\bigr)$$

where:
- $(x, y)$ is the world stage point centered in the viewport (center-origin stage, `(0, 0)` at center).
- $z > 0$ is optical zoom (`1.0` = nominal 1:1 design scale; `2.5` = 250% zoomed in).
- $\theta$ is camera roll in degrees (subtle `±0.5°–1.8°` during shakes or dynamic whips).

---

## 1. Stage-to-Screen Projection Math

Given a world actor centered at $(w_x, w_y)$ with size $(w_w, w_h)$ and viewport dimensions $(W, H)$ with aspect scale $s_{\text{stage}}$:

1. Translate relative to camera: $\Delta x = w_x - x(t)$, $\Delta y = w_y - y(t)$.
2. Rotate by $-\theta(t)$ and scale by $z(t) \cdot s_{\text{stage}}$:
   $$p_x = \frac{W}{2} + z(t) \cdot s_{\text{stage}} \cdot (\Delta x \cos\theta + \Delta y \sin\theta)$$
   $$p_y = \frac{H}{2} + z(t) \cdot s_{\text{stage}} \cdot (-\Delta x \sin\theta + \Delta y \cos\theta)$$
3. Projected bounding box size:
   $$b_w = w_w \cdot z(t) \cdot s_{\text{stage}}, \qquad b_h = w_h \cdot z(t) \cdot s_{\text{stage}}$$

Using this single projection formula in both `CameraRig.tsx` (CSS transform) and `manifest.mjs` (Node evaluator) guarantees zero discrepancy between rendered pixels and `verify.mjs` framing/IoU checks.

---

## 2. The Six Camera Presets

### 2.1 `hold`
- **Behavior:** Camera holds position $(x_{\text{target}}, y_{\text{target}}, z_{\text{target}})$ cleanly so the viewer reads copy or UI details.
- **Usage:** Combine with gentle micro-breathing (`floatIntensity: 0.15–0.3`) only if the beat exceeds `1.8s`; use `floatIntensity: 0` for crisp typography locks.

### 2.2 `float`
- **Behavior:** Low-amplitude organic handheld breathing driven by 2D seeded simplex noise (`noise2D(seed, t * freq)`):
  $$\Delta x_{\text{float}} = A_x \cdot \text{simplex}(s, 0.42\,t), \qquad \Delta y_{\text{float}} = A_y \cdot \text{simplex}(s + 17.3, 0.37\,t), \qquad \Delta\theta = A_\theta \cdot \text{simplex}(s + 41.9, 0.29\,t)$$
- **Default Amplitudes:** $A_x = 8\text{ px}$, $A_y = 6\text{ px}$, $A_\theta = 0.35^\circ$ scaled inversely by $\sqrt{z}$ so deep zooms never become jittery.

### 2.3 `follow`
- **Behavior:** Tracks a moving hero actor while looking slightly ahead along its velocity vector so the actor never presses against the leading frame edge:
  $$\mathbf{C}_{\text{pos}}(t) = \text{lerp}\bigl(\mathbf{C}_{\text{start}},\, \mathbf{p}_{\text{actor}}(t) + k_{\text{lead}} \cdot \mathbf{v}_{\text{actor}}(t),\, u(t)\bigr)$$
- **Guideline:** Use $k_{\text{lead}} \approx 0.12\text{ s}$ and smooth with `soft` or `snappy` easing.

### 2.4 `whip`
- **Behavior:** High-acceleration directional pan from coordinate $\mathbf{A}$ to $\mathbf{B}$ driven by `whipQuart` easing across `0.35s–0.55s`, optionally peaking zoom down slightly ($z_{\text{mid}} = 0.88 \cdot z$) at midpoint $u = 0.5$ (subtle "breathing pullback") to amplify spatial context before landing on $\mathbf{B}$.
- **Rule:** Must always trigger **Gate G5 directional motion blur** during peak velocity and land into at least $8$ frames of calm settle (**Gate G3.4**).

### 2.5 `pushThrough` (Logarithmic Portal Zoom)
- **Behavior:** Exponential optical zoom into a portal actor's center so perceived forward speed remains linear even across $1\times \to 10\times$ magnification:
  $$z(t) = z_0 \cdot \left(\frac{z_1}{z_0}\right)^{u(t)} = \exp\Bigl(\ln z_0 + u(t)\,(\ln z_1 - \ln z_0)\Bigr)$$
- **Critical:** Always interpolate zoom in **log space**, never linear space! Linear interpolation from $1\times$ to $6\times$ feels frantic at the start and sluggish at the end.

### 2.6 `shake` (Trauma Impulse)
- **Behavior:** Triggered at an impact timestamp $t_0$ with amplitude $A$ and decay constant $\lambda$:
  $$\Delta x_{\text{shake}}(t) = A \cdot e^{-\lambda (t - t_0)} \sin\bigl(\omega_x (t - t_0) + \phi_x\bigr)$$
  $$\Delta y_{\text{shake}}(t) = A \cdot e^{-\lambda (t - t_0)} \cos\bigl(\omega_y (t - t_0) + \phi_y\bigr)$$
  $$\Delta \theta_{\text{shake}}(t) = 0.04 A \cdot e^{-\lambda (t - t_0)} \sin\bigl(\omega_r (t - t_0)\bigr)$$
- **Defaults:** $\lambda \approx 11\text{ s}^{-1}$ (settles in $\sim 0.35\text{ s}$), $\omega \approx 48\text{ rad/s}$, amplitude $A \in [6, 22]\text{ px}$. Always decays completely to zero before the settle window ends.

---

## 3. Continuous Inter-Beat Camera Blending

Never step camera coordinates directly on a beat boundary $t_b$. Each beat defines its target camera pose `(targetX, targetY, targetZoom, targetRoll)` and entry blend window `entryBlendSec` (default `min(0.45, duration * 0.4)`). The camera rig blends smoothly from the previous beat's terminal pose using the beat's assigned preset (`whipQuart` for `whip`, `heavy` log-zoom for `pushThrough`, `snappy` for `follow`), guaranteeing $C^0$ continuity everywhere.
