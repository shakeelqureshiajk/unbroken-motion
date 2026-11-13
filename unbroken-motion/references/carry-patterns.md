# Canonical Carry Patterns (`references/carry-patterns.md`)

Every transition in `unbroken-motion` executes one of the canonical boundary handoffs defined below. Each pattern establishes a clear, measurable visual chain between `beat[i].handoff.carryActor` and `beat[i+1]`'s `targetActor`.

---

## 1. The Five Primary Carry Modes (Schema Enum)

### 1.1 `morph` — Geometric Transformation
- **What happens:** Actor A stays centered or glides smoothly along a continuous curve while interpolating `width`, `height`, `borderRadius`, `backgroundColor`, and internal content fade into Actor B.
- **When to use:** Spark dot $\to$ command bar; pill badge $\to$ full modal card; progress bar $\to$ timeline track.
- **Parameter Guardrails:**
  - `windowSec`: `0.35s – 0.65s`
  - Curve: `snappy` or `overshoot`
  - Overlap check: Centroid stays continuous; scale ratio per frame stays $\le 1.25$ at all frames (use easing derivatives so peak frame ratio never spikes above 1.25).

### 1.2 `portal` — Push-Through Scale Reveal (`pushThrough`)
- **What happens:** Camera zooms exponentially (`z0 -> z1`) into a bounded Actor (a card, button, screen tile, or lens ring). As the actor expands past `65%` of viewport area, its exterior frame clears the screen edges and its interior contents become the entire next beat's world stage.
- **When to use:** Macro overview $\to$ detailed feature UI; dashboard card $\to$ full workflow canvas; phone screen $\to$ app workspace.
- **Parameter Guardrails:**
  - `windowSec`: `0.45s – 0.75s`
  - Curve: `heavy` or `snappy` in **log-zoom space**
  - G4 Safe-Zone Exemption: Once the portal actor's screen area exceeds `65%` of the viewport, Gate G4 exempts it from safe-zone containment because it *is* the new frame.

### 1.3 `detach` — Child Extraction & Background Recession
- **What happens:** While inside a parent UI shell (dropdown menu, notification stack, grid), one specific child `<Actor>` highlights, scales up slightly (`1.0x -> 1.12x`), detaches onto the foreground Z-plane, and travels smoothly to become Beat $i+1$'s hero (e.g., docking inside an input bar as a chip) while the old parent fades/scales back (`1.0x -> 0.85x, opacity -> 0`).
- **When to use:** Selecting an action from a command menu; dragging a metric out of a table into a summary card.
- **Parameter Guardrails:**
  - `windowSec`: `0.40s – 0.65s`
  - Notice: The **detached child** is declared as `carryActor -> targetActor` (NOT the receding parent), ensuring continuous visibility and bounding-box tracking across the entire boundary.

### 1.4 `tether` — Directed Energy / Beam Whip
- **What happens:** An active element emits a visible physical connector (cursor sweep, luminous tether line, or traveling data pulse) toward a new coordinate off-axis. The virtual camera `whip`-pans along the tether vector so the viewer's eye tracks the traveling pulse straight onto `targetActor`.
- **When to use:** Triggering a downstream effect across a large product architecture; jumping from a prompt action to a live output dashboard.
- **Parameter Guardrails:**
  - `windowSec`: `0.35s – 0.55s`
  - Note on Gate G2: The traveling tether pulse (or cursor actor) itself is the `carryActor` whose bounding box moves smoothly from origin to destination—keeping centroid jump per frame smooth while camera motion blur streaks the background.

### 1.5 `collapse` — Multi-Actor Convergence
- **What happens:** Multiple active cards, chips, or bars smoothly pull toward a shared focal point, compressing and merging into one unified icon, badge, or brand mark (`targetActor`).
- **When to use:** Resolving complex feature complexity into simplicity; ending a product demo on the brand logo lockup.
- **Parameter Guardrails:**
  - `windowSec`: `0.45s – 0.70s`
  - One designated lead actor serves as `carryActor` across the boundary so `verify.mjs` tracks a continuous bounding box into the merged anchor while siblings converge onto its coordinates.

---

## 2. Three Composite Choreography Recipes

Combine the five base modes for signature storytelling moments:

1. **Click $\to$ Detach $\to$ Dock (`ui-workflow`):**
   Cursor clicks menu row (`shake` micro-tap) $\to$ menu row executes `detach` $\to$ travels up-left into prompt input bar (`morph` into rounded chip) $\to$ prompt bar pulses (`portal` into live result).
2. **Accordion Reflow (`split-converge`):**
   One card splits laterally into three metric tiles (`morph` + sibling reveal); after a showcase hold, tiles `collapse` back into a single status pill that glides to the center.
3. **Micro-to-Macro Tether (`beam-whip`):**
   A tiny notification dot sparks a `tether` beam downward; camera `whip`-tracks the beam head until it strikes a button, triggering an immediate `pushThrough` portal into the dashboard.

---

## 3. Anti-Patterns (Never Do These)

- **Fade-and-Swap:** Setting `opacity: 0` at `windowEnd` on Actor A while fading Actor B from `0 -> 1` in a totally different spot.
- **Static Watermark Carry:** Leaving a corner brand logo untouched across all beats and naming it `carryActor`. Gate G2.4 explicitly rejects carries with negligible geometry/position transformation (`Δpos <= 24px && Δscale <= 15%`).
- **Teleporting Cursor:** Moving a cursor from `(400, 300)` to `(-500, -200)` instantaneously across a beat line.
