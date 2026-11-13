# Procedural & Event-Driven Sound Design (`references/sound.md`)

Audio turns visual physics into tactile weight. Every camera impulse, UI morph, click, and portal entry receives tight sample-accurate sound routed through one shared physical room space and normalized for social/web delivery.

---

## 1. Zero-Dependency Procedural SFX Bank (`scripts/synth-sfx.mjs`)

To ensure every generated film has clean, legal, zero-latency audio without searching external stock libraries, `synth-sfx.mjs` synthesizes a 48 kHz / 16-bit PCM WAV bank directly from math (CC0):

| Asset Name | Synthesis Recipe | Intended Visual Event |
|---|---|---|
| `impact-deep.wav` | Sub-sine pitch drop (`135Hz -> 42Hz` over `180ms`) + soft low-passed transient click | Heavy landing, portal entry, brand lockup hit |
| `whoosh-fast.wav` | Band-pass swept pink/white noise (`220Hz -> 2400Hz -> 380Hz`) with asymmetric attack/release (`320ms`) | Fast `whip` pan, `detach` chip flight |
| `whoosh-soft.wav` | Smooth low-mid filtered air sweep (`160Hz -> 900Hz -> 220Hz`, `520ms`) | `morph` expansion, gentle `pushThrough` |
| `ui-click.wav` | 2-cycle damped high-Q resonant impulse (`1800Hz` + `3200Hz` over `28ms`) | Cursor button click, menu selection |
| `ui-pop.wav` | Crisp upward sine chirp (`420Hz -> 980Hz` over `65ms`) | Seed dot spawn, badge/chip appearance |
| `key-tick.wav` | Ultra-short muted wooden/mechanical transient (`950Hz` decay `18ms`) | Typing characters inside `CommandBar` |
| `riser-short.wav` | Rising harmonic shimmer + filtered swell (`550ms`) | Anticipation leading into final `collapse` |
| `ambient-bed.wav` | Warm low-volume harmonic drone pad (`C2 + G2 + D3` soft sine/triangle with slow LFO filter) | Optional subtle underscore bed if user provides no music track |

---

## 2. Event Alignment & Auto-Detection (`scripts/sound.mjs`)

`sound.mjs` builds the audio timeline from **two sources**:
1. **Explicit `audioEvents`** declared in `beats.json`:
   ```json
   { "atSec": 1.15, "type": "whoosh", "intensity": 0.85 }
   ```
2. **Automatic Manifest Inference** (optional `--auto-sfx`, enabled when beats omit manual events or to catch camera impacts):
   - Camera speed crosses `> 32 px/f` rising edge $\implies$ trigger `whoosh-fast` slightly anticipating peak (`-0.08s`).
   - Camera `trauma` rises above `0.2` $\implies$ trigger `impact-deep` at frame exact timestamp.

### Timing Rule (Gate G6.3)
Every declared `impact` or `whoosh` event must produce a measurable RMS/peak transient in the mixed audio track within **$\pm 2$ frames** ($\pm 66\text{ ms}$ at 30fps) of its target timestamp.

---

## 3. Shared Space Mixing & Side-Chain Ducking

Instead of slapping dry WAV samples onto a music bed, `sound.mjs` writes an `ffmpeg` `-filter_complex_script` that applies four studio stages:

1. **Gain Staging & Sample Delay:** Places each SFX at exact millisecond offsets (`adelay=1150|1150`) scaled by `intensity`.
2. **Shared Room Cohesion:** Sums all SFX into an SFX bus and adds a subtle shared stereo room reflection (`aecho=0.8:0.85:28|47:0.16|0.10`) so clicks, whooshes, and impacts sound as if they occupy one physical environment.
3. **Music Side-Chain Ducking:** Ducks the background music/ambient bed whenever the SFX bus fires (`sidechaincompress=threshold=0.05:ratio=4.5:attack=12:release=220`).
4. **Broadcast Loudness & True-Peak Protection (Gate G6):**
   Passes the master sum through `loudnorm=I=-14:TP=-1.0:LRA=9` and verifies via `ffmpeg astats,ebur128`:
   - **True Peak $\le -1.0\text{ dBTP}$** (zero digital clipping).
   - **Integrated Loudness within $-14 \pm 2\text{ LUFS}$**.

---

## 4. Attribution (`CREDITS.md`)
Every time `sound.mjs` mixes audio for `cases/<film>`, it automatically updates `cases/<film>/CREDITS.md` listing whether procedural CC0 SFX/bed or user-supplied stems were used, preserving clear commercial auditability.
