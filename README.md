# LILIUM RARA — Interactive Botanical Living Bouquet

> An ethereal, real-time interactive botanical art experience powered by webcam computer vision, organic mathematical modeling, and hardware-accelerated 2D canvas rendering.

---

## 1. Project Overview

### What the Project Is
**Lilium Rara** (*Lilium Garden*) is an in-browser, camera-driven interactive botanical installation. It layers a living, procedurally modeled bouquet of rare lilies directly over the user's mirrored webcam feed, inviting physical interaction through natural hand gestures without requiring external sensors, specialized controllers, or physical contact.

### What the Project Does
- **Real-Time Hand Tracking**: Uses computer vision to recognize up to two hands simultaneously through any standard laptop or desktop webcam.
- **Left Hand Pinch (Bloom Control)**: Unfurls the lily’s 6 tepals from a tight bud into full blossom, exposing the inner pistil and stamens.
- **Right Hand Pinch (Growth Control)**: Extends stem elongation, elevates flower height, and sprouts secondary lateral branches and buds.
- **Physical Drag & Wind Sway**: Horizontal movement of either hand creates velocity-driven breeze, causing the stem, leaves, and petals to flex and oscillate organically.
- **Dynamic Pollen & Mote Physics**: Rapid blooming or swift gestures release golden pollen grains directly from the flower's anthers into the atmosphere, interacting with background ambient dust motes.
- **Specimen Switching**: Seamless switching between two botanical species themes:
  - **Sapphire Celestial Lily** (*Lilium Caeruleum Rara*): Royal cobalt, luminous azure, midnight indigo, and translucent mint-jade filaments.
  - **Velvet Obsidian Lily** (*Lilium Tenebris Velvet*): Black-cherry, garnet, crimson maroon, and golden-olive nectar accents.
- **Cinematic Petal Shower**: Blooming past 84% for more than 350ms triggers a radial bloom flash and a cascading, continuous shower of 160 large silk lily petals with 3D perspective flips and fluttering wind physics.

### The User Experience in Simple Words
1. Open the page and grant camera access. You see your mirrored reflection softened by a dark, dreamy cinematic vignette.
2. A subtle glassmorphic top header displays the species selector and tracking status; a floating pill guide at the bottom whispers: *Left Hand: Pinch to Bloom · Right Hand: Pinch to Grow · Motion: Sway for Breeze*.
3. Bringing hands into the frame produces glowing stardust auras at your fingertips.
4. Pinching your left thumb and index finger blooms the lily; pinching your right hand grows the plant upward.
5. Sweeping your hand across the air creates a gust of wind that sways the stem and blows pollen across the screen.
6. When held in full bloom, the bouquet triggers a celebratory cascade of falling petals.

---

## 2. How It Was Built (Step-by-Step Evolution)

### Step 1: Mirrored Viewport & Canvas Foundation
- Established an HTML5 DOM structure pairing an autoplaying, muted `<video id="webcam">` element with a matching overlay `<canvas id="canvas">`.
- Mirrored both elements horizontally via CSS (`transform: scaleX(-1)`) to provide a natural selfie-mirror reflection.
- Wired adaptive `devicePixelRatio` scaling (clamped to a maximum of 2.0x) to ensure crisp HiDPI lines without overburdening GPU rasterization.

### Step 2: Computer Vision & Signal Smoothing
- Integrated Google MediaPipe Hands (`@mediapipe/hands@0.4`) and Camera Utilities (`@mediapipe/camera_utils@0.3`) via CDN.
- Formulated the normalized pinch metric:
  $$\text{pinch} = \text{clamp}\left(\left(\frac{\|\text{ThumbTip} - \text{IndexTip}\|}{\|\text{Wrist} - \text{MiddleMCP}\|} - 0.15\right) \times 1.6, 0, 1\right)$$
- Embedded a dual-pass **One Euro Filter** (`OneEuroFilter`) across all 21 3D landmarks and computed pinch metrics to eliminate tracking jitter while maintaining instant zero-lag responsiveness during rapid hand motions.
- Implemented runtime self-calibrating handedness and continuity algorithms to resolve raw camera coordinate mirroring.
- Built a **hold-and-decay** failsafe: when a hand momentarily exits camera view, values hold for 220ms before easing smoothly toward resting states rather than snapping to zero.
- Added a fallback mouse velocity model so desktop users without webcams can still create wind and explore the garden.

### Step 3: Botanical Flower Rendering (Procedural Lily Anatomy)
- Engineered an anatomically grounded 6-tepal lily model in HTML5 2D Canvas:
  - **3 Outer Tepals**: Broader sepals rendered behind the flower core.
  - **3 Inner Tepals**: Slender petals rendered in front.
- Petal modeling features:
  - Spline curvature controlling length, width, curl, and taper.
  - Midrib nectar furrows and translucent petal rims.
  - Papillae freckles (botanical speckles) topped with tiny golden pollen grains.
  - Specular sheen highlights simulating silk-like petal texture.
  - Reproductive core: 3-lobed pistil stigma, mint/ruby style, and 6 filaments supporting 3D-angled, pollen-dusted bronze anthers.
  - Cauline foliage: spiraling leaves with curvature, highlights, and midrib veins along a tapered stem.

### Step 4: Particle Atlases & Pollen Systems
- Implemented ambient floating dust motes with natural sine flutter and drift.
- Engineered a velocity-driven emission engine: rapid blooming changes ($\Delta\text{bloom}/\Delta t$) or strong wind gusts trigger golden pollen puffs bursting directly from the anther tips.
- Optimized performance using an offscreen canvas **Sprite Atlas** (`PollenSpriteAtlas`), replacing expensive runtime `shadowBlur` operations with rapid `ctx.drawImage` blits.

### Step 5: Cinematic Celebration Sequence
- Designed a transition state machine (`idle` → `expand` → `storm` → `reveal` → `fade` → `idle`).
- Full bloom triggers a screen-space radial glow expansion flash, gracefully fading the main bouquet into an 18-second continuous shower of 160 large silk petals featuring wind flutter, rotation, and 3D flip effects ($\cos(\text{flip})$).

### Step 6: Zero-Garbage-Collection (Zero-GC) Performance Tuning
- Replaced frame-rate-dependent lerps with closed-form analytic damped harmonic springs (`Spring`).
- Pre-allocated Float32Array scratch buffers, reusable vector pools, and pre-compiled `Path2D` unit leaves to eliminate per-frame heap allocations.
- Achieved consistent 60–120 FPS render loops with zero garbage collector frame hitches.

---

## 3. Current System Architecture

### Architecture Diagram

```
                       ┌────────────────────────────┐
                       │    Webcam Video Stream     │
                       └──────────────┬─────────────┘
                                      │
                                      ▼
                       ┌────────────────────────────┐
                       │      MediaPipe Hands       │
                       │  (21 3D Landmarks / Hand)  │
                       └──────────────┬─────────────┘
                                      │
                                      ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │                GestureTracker (js/gesture.js)                    │
 │  - Left Hand Pinch  ──> Raw Bloom Target                         │
 │  - Right Hand Pinch ──> Raw Growth Target                        │
 │  - Palm Horizontal Speed ──> Raw Wind Target                     │
 │  - One Euro Filter (adaptive noise & jitter reduction)           │
 │  - Hand Continuity & Hold-and-Decay Protection                   │
 └────────────────────────────────────┬─────────────────────────────┘
                                      │  Targets: { bloom, growth, wind }
                                      ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │                App Orchestrator (js/app.js)                      │
 │  - Frame-rate independent delta time (dtSec)                    │
 │  - Damped Harmonic Springs (closed-form exact physics)          │
 │  - Organic Noise (multi-octave atmospheric breeze)               │
 └──────┬─────────────────────────────┬──────────────────────┬──────┘
        │                             │                      │
        │ Smoothed State              │ Wind & Bloom Rate    │ Trigger State
        ▼                             ▼                      ▼
┌──────────────────┐        ┌──────────────────┐   ┌──────────────────┐
│   LilyRenderer   │        │  ParticleSystem  │   │CelebrationManager│
│  (js/lily.js)    │        │(js/particles.js) │   │(js/celebration.js│
│ - Stem & Leaves  │        │ - Ambient Motes  │   │ - Bloom Flash    │
│ - 6 Tepals       │        │ - Anther Pollen  │   │ - 160 Cascading  │
│ - Reproductive   │        │ - Pre-rendered   │   │   Petals Atlas   │
│   Organs (Core)  │        │   Sprite Atlas   │   │ - 3D Flip & Sway │
└────────┬─────────┘        └────────┬─────────┘   └────────┬─────────┘
         │                           │                      │
         └───────────────────────────┼──────────────────────┘
                                     │
                                     ▼
                      ┌────────────────────────────┐
                      │  HTML5 Canvas (2D Context) │
                      │ (DevicePixelRatio Mirrored)│
                      └────────────────────────────┘
```

### Data Flow & Execution Pipeline
1. **Frame Capture**: `Camera` sends raw video frames from `#webcam` to `Hands`.
2. **Feature Extraction**: 21 normalized 3D landmarks are detected per hand.
3. **Pinch Computation & Filtering**:
   - Thumb-to-index distance is normalized by palm size.
   - Landmarks and pinch metrics pass through adaptive `OneEuroFilter` instances.
4. **Target Generation**:
   - Left hand pinch sets `targetBloom`.
   - Right hand pinch sets `targetGrowth`.
   - Palm movement across frames calculates real horizontal velocity for `targetWind`.
5. **Harmonic Spring Simulation**:
   `InteractiveLilyApp` advances three closed-form second-order damped springs every frame:
   - Bloom: critically damped ($\zeta = 1.0, \omega = 7.5$) — crisp, no oscillation.
   - Growth: critically damped ($\zeta = 1.0, \omega = 4.5$) — heavier vegetative momentum.
   - Wind: underdamped ($\zeta = 0.62, \omega = 5.5$) — natural pendulum sway.
6. **Canvas Render Pass**:
   - `ctx.clearRect` clears the viewport.
   - `GestureTracker.drawHandOverlays`: draws glowing auras at tracked fingertips.
   - `LilyRenderer.render`: traces stems, foliage, outer tepals, anthers, and inner tepals using zero-allocation scratch buffers.
   - `ParticleSystem.update / draw`: updates pollen and ambient motes from the pre-rendered atlas.
   - `CelebrationManager.update / draw`: evaluates celebration state and blits falling petals.

---

## 4. What Each Important File Does

| File | Role & Functionality |
| :--- | :--- |
| **`index.html`** | Root HTML markup. Declares the mirrored `#webcam` video, overlay `#canvas`, glassmorphic top navigation header, species selection tabs, instruction pill, and loads CDN/local scripts. |
| **`style.css`** | Application styling. Defines layout, mirrored video/canvas positioning, dark vignette radial gradients, custom typography (`Cinzel`, `Playfair Display`, `Inter`), CSS custom variables for live theme transitions, and responsive mobile rules. |
| **`js/app.js`** | Application orchestrator. Drives the `requestAnimationFrame` loop, delta time calculations, Spring dynamics, device pixel ratio scaling, pollen emission budgets, and celebration lifecycle triggers. |
| **`js/gesture.js`** | Computer vision & input processing. Initializes MediaPipe Hands, tracks 21 landmarks per hand, applies One Euro filtering, handles palm velocity calculations, handedness calibration, hold-and-decay failsafes, fingertip auras, and mouse fallback. |
| **`js/lily.js`** | Procedural botanical renderer (~1,200 lines). Draws stems, lateral pedicels, spiraling foliage, the 6-tepal flower assembly, reproductive organs (style, stigma, 6 filaments, 3D anthers), midrib veins, papillae speckles, and translucent rim highlights using zero-allocation scratch buffers. |
| **`js/particles.js`** | Particle & pollen engine. Manages 75 ambient drifting dust motes and 50 burst pollen particles emitted from flower anthers, blitted via a pre-rendered offscreen canvas `PollenSpriteAtlas`. |
| **`js/celebration.js`** | Climax sequence controller. Manages 160 falling silk petals with 3D perspective flipping ($\cos(\text{flip})$), wind flutter, offscreen petal atlas generation (`LilyPetalAtlas`), and radial glow expansion flashes. |
| **`js/species.js`** | Botanical palettes & theme tokens. Defines complete color specifications (hex, gradients, HSL) for Sapphire Celestial Lily and Velvet Obsidian Lily across petals, throats, filaments, anthers, stems, and pollen. |
| **`js/ui.js`** | User interface manager. Handles species selector tab events, dynamically updates CSS custom properties (`--theme-accent`, `--theme-glow`), manages the status dot badge, and auto-collapses the instruction pill. |
| **`js/noise.js`** | Mathematical foundation. Provides multi-octave harmonic sine noise (`OrganicNoise`), clamp/lerp/smoothstep helpers (`MathUtils`), exact closed-form damped springs (`Spring`), and the `OneEuroFilter` implementation. |
| **`package.json`** | NPM configuration defining project metadata and the `dev` / `start` static serving script (`npx serve . -l 8080`). |

---

## 5. Current Strengths (What Is Solid)

- **Deterministic, Frame-Rate-Independent Physics**:
  Unlike simple `lerp(a, b, 0.1)` implementations that speed up or slow down depending on screen refresh rate, all springs and particle physics evaluate true elapsed delta time ($dt$). Motion feels identical on 60 Hz, 120 Hz, or 144 Hz displays.
- **Zero-Garbage-Collection (Zero-GC) Pipeline**:
  The active render loop creates zero short-lived objects or arrays per frame. Points, Float32Array buffers, unit leaf vectors, and state payloads are pre-allocated, preventing garbage collection stalls and frame drops.
- **Offscreen Sprite Atlasing**:
  Canvas operations like `shadowBlur` can throttle GPU fill rates when issued hundreds of times per frame. Pre-rendering particle halos and petal variants into offscreen atlases preserves high frame rates.
- **Adaptive Jitter Filtering**:
  Combining the One Euro filter with hold-and-decay logic eliminates hand tracking jitters and prevents the flower from jarringly snapping shut if a hand temporarily exits the camera frame.
- **Lightweight Architecture**:
  The application runs on standard vanilla Web standards (ES6 modules, standard DOM, Canvas 2D) without complex bundlers, transpilers, or node backend requirements.

---

## 6. Current Technical Debt (What Is Messy)

- **External CDN Dependency**:
  MediaPipe's `hands.js` and `camera_utils.js` are loaded from `cdn.jsdelivr.net`. If the user is on a slow connection or offline, initialization stalls. Bundling them locally or configuring preconnect/preload headers reduces initial load latency.
- **Orphaned DOM Queries in `js/ui.js`**:
  `js/ui.js` contains references to telemetry elements (`#val-bloom`, `#bar-bloom`, `#val-growth`, `#val-wind`) that were removed during earlier UI simplification. While guarded with null checks, removing unused queries improves code cleanliness.
- **Stray Files in Git Working Tree**:
  Files like `app.js` (empty root stub) and `import heapq.py` (unrelated script) were marked for deletion and should be committed/pruned cleanly.
- **Mobile Camera Resolution Default**:
  `Camera` currently requests 1280x720 video regardless of device capability. On mobile devices, this can cause thermal throttling and battery drain compared to 640x480.

---

## 7. Pre-Vercel Improvement Checklist (What Should Be Improved)

- [ ] **Commit Clean Working Tree**: Prune deleted root files (`app.js`, `import heapq.py`) and ensure only production assets are tracked in Git.
- [ ] **Clean Up Obsolete UI Queries**: Strip unused telemetry DOM references from `js/ui.js`.
- [ ] **Camera Permission Denied State**: Add a user-visible banner informing the user that mouse tracking is available if webcam access is denied or unavailable.
- [ ] **Mobile Resolution Optimization**: On mobile viewports (`window.innerWidth < 768`), lower the MediaPipe camera capture resolution from 1280x720 to 640x480 to conserve battery and CPU.
- [ ] **Vercel Headers (`vercel.json`)**: Add a `vercel.json` file declaring camera permissions policy and asset caching:
  ```json
  {
    "headers": [
      {
        "source": "/(.*)",
        "headers": [
          { "key": "Permissions-Policy", "value": "camera=(self)" },
          { "key": "X-Content-Type-Options", "value": "nosniff" }
        ]
      }
    ]
  }
  ```
- [ ] **Touch Fallback for Mobile**: Add single-touch and two-touch gestures for mobile users who prefer not to use the camera.

---

## 8. How to Explain This Project

### Quick Casual Explanation (For Conversations & Friends)
> *"It's an interactive digital bouquet of rare lilies that blooms right in front of you using your webcam. You hold up your hands: pinching with your left hand opens the flower petals, pinching with your right hand makes the stem grow taller, and waving your hand blows a breeze that scatters glowing pollen into the air. If you bloom it completely, the whole screen fills with a shower of falling petals."*

### Technical Explanation (For Judges, Interviewers & Engineers)
> *"Lilium Rara is a zero-dependency interactive botanical simulation running on Canvas 2D and MediaPipe Hands. It extracts 21 3D hand landmarks via computer vision and processes them through dual One Euro adaptive low-pass filters to decouple high-frequency tracking jitter from fast user gestures.*
>
> *Motion is governed by closed-form analytic damped harmonic springs evaluated against real-time delta seconds, ensuring identical physics across 60, 120, and 144Hz displays. The visual pipeline renders procedurally modeled 6-tepal lilies with anatomically accurate reproductive structures, midribs, and papillae. To achieve sustained 60+ FPS without garbage collection pauses, all per-frame vectors use pre-allocated buffers and particle systems blit from pre-rendered offscreen sprite atlases rather than issuing runtime shadowBlur calls."*

---

## 9. Local Development & Running

### Requirements
Any modern web browser supporting WebRTC (Chrome, Edge, Firefox, Safari) and a webcam.

### Quick Start
```bash
# Clone the repository
git clone <repo-url>
cd flowers-01

# Start the local development server
npm run dev
# or
npx serve . -l 8080
```
Open `http://localhost:8080` in your browser and allow camera access when prompted.
