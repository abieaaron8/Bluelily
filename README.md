Lilium Rara is a browser-based interactive lily garden that uses your webcam and hand gestures to make a digital flower bloom, grow, sway in the wind, and burst into a cinematic celebration sequence.

## Features

- Real-time webcam interaction
- Hand gesture tracking with MediaPipe Hands
- Left pinch to bloom the flower
- Right pinch to grow the stem and bouquet
- Hand movement to create wind and sway
- Procedural lily rendering in Canvas 2D
- Ambient pollen and particle effects
- Celebration petal shower on full bloom
- Modular front-end architecture
- Static-site friendly, no backend required

## Controls

- Allow camera access to start
- Left hand pinch: bloom
- Right hand pinch: grow
- Move hand horizontally: wind
- Switch species using the top UI tabs

## How It Works

1. The webcam provides a live mirrored video feed.
2. MediaPipe Hands detects up to two hands in real time.
3. Gesture logic converts hand motion into bloom, growth, and wind targets.
4. Spring physics smooths the motion so the flower reacts naturally.
5. The lily renderer draws the stem, leaves, petals, and flower core on a canvas overlay.
6. Particle effects add pollen and atmosphere.
7. When the flower reaches full bloom, the celebration sequence begins.

## Build Story

### 1. Webcam and Canvas Foundation
The project started as a full-screen browser experience with a webcam video layer and a canvas overlay. This created the visual structure for the interactive flower.

### 2. Gesture Tracking
MediaPipe Hands was added to detect hand landmarks from the camera feed. Pinch distance and hand movement were turned into interaction signals.

### 3. Motion Smoothing
To avoid jitter and sudden jumps, the project uses filtering and spring-based motion instead of raw frame-to-frame movement.

### 4. Lily Rendering
The flower was built procedurally in Canvas 2D, with stems, leaves, tepals, and botanical details rendered from code.

### 5. Particle Atmosphere
Pollen and drifting motes were added to make the flower feel alive and cinematic.

### 6. Celebration Sequence
A bloom threshold triggers a celebration state that transforms the flower into a petal shower / reveal sequence.

### 7. Performance Optimization
The project was optimized with reused buffers, pre-rendered particle atlases, and reduced per-frame allocations.

## Architecture

Webcam
  ↓
MediaPipe Hands
  ↓
GestureTracker
  ↓
Smoothed targets: bloom / growth / wind
  ↓
App orchestrator
  ↓
LilyRenderer + ParticleSystem + CelebrationManager
  ↓
HTML5 Canvas overlay
Data Flow
The webcam feeds live video into MediaPipe Hands.
GestureTracker extracts hand landmarks and converts them into usable control signals.
The app orchestrator applies motion smoothing and frame timing.
LilyRenderer draws the botanical flower.
ParticleSystem adds pollen and ambient motion.
CelebrationManager controls the final bloom and petal sequence.

File Structure
.
├── index.html
├── style.css
├── js/
│   ├── app.js
│   ├── gesture.js
│   ├── lily.js
│   ├── particles.js
│   ├── celebration.js
│   ├── ui.js
│   ├── noise.js
│   └── species.js
└── assets/
