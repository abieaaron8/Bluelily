/* =============================================================
   APPLICATION ORCHESTRATOR
   Integrates GestureTracker, FaceDetection, LilyRenderer,
   ParticleSystem, CelebrationManager, and UIManager.
   ============================================================= */

class InteractiveLilyApp {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('webcam');

        // Core systems
        this.noise = new OrganicNoise();
        this.particles = new ParticleSystem(window.innerWidth, window.innerHeight);
        this.lily = new LilyRenderer();
        this.celebration = new CelebrationManager();

        // State variables (smoothed for organic visual feel)
        this.bloom = 0;
        this.growth = 0.28;
        this.windForce = 0;

        // Detection targets from gestures
        this.targetBloom = 0.15;
        this.targetGrowth = 0.45;
        this.targetWind = 0;

        // Time tracking
        this.time = 0;
        this.lastTimestamp = 0;
        this.lastBloomForSparkle = 0;
        this.celebrationSustainTimer = 0;

        // Loading screen 3-second minimum duration enforcement
        this.cameraReady = false;
        this.minLoadingElapsed = false;
        setTimeout(() => {
            this.minLoadingElapsed = true;
            this.checkDismissLoading();
        }, 3000);

        // UI Manager
        this.ui = new UIManager({
            onSpeciesChange: (key) => {
                this.lily.setSpecies(key);
            }
        });

        // Resize handler
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Gesture & Face Tracker (MediaPipe)
        this.gestureTracker = new GestureTracker(this.video, {
            onTrackingReady: () => {
                this.cameraReady = true;
                this.checkDismissLoading();
            },
            onTargetsUpdate: (data) => {
                this.targetBloom = data.targetBloom;
                this.targetGrowth = Math.max(0.1, data.targetGrowth);
                this.targetWind = data.targetWind;
                this.ui.updateTrackingStatus(data.handsCount);
            }
        });

        // Start render loop
        requestAnimationFrame((ts) => this.renderLoop(ts));
    }

    checkDismissLoading() {
        if (this.cameraReady && this.minLoadingElapsed) {
            this.ui.setLoadingComplete();
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.particles.resize(this.canvas.width, this.canvas.height);
    }

    renderLoop(timestamp) {
        const dt = this.lastTimestamp ? Math.min(2.0, (timestamp - this.lastTimestamp) / 16.67) : 1;
        this.lastTimestamp = timestamp;
        this.time += 0.016 * dt;

        const ctx = this.ctx;
        const cw = this.canvas.width;
        const ch = this.canvas.height;

        // --- 1. Smooth interpolation between gesture targets & visible state ---
        const bloomLerp = 0.065 * dt;
        const growthLerp = 0.045 * dt;
        const windLerp = 0.075 * dt;

        this.bloom += (this.targetBloom - this.bloom) * bloomLerp;
        this.growth += (this.targetGrowth - this.growth) * growthLerp;
        this.windForce += (this.targetWind - this.windForce) * windLerp;

        // Ambient gentle atmospheric breeze
        const naturalBreeze = this.noise.get(this.time * 0.7, 1) * 0.14;
        const totalWind = naturalBreeze + this.windForce * 0.22;

        // --- 2. Check Celebration Trigger Threshold ---
        // When main flower blooms from hand gesture input (~0.85+)
        if (this.bloom >= 0.84 && this.celebration.state === 'idle') {
            this.celebrationSustainTimer += dt * 0.016;
            if (this.celebrationSustainTimer > 0.35) {
                this.celebration.trigger();
            }
        } else if (this.bloom < 0.70) {
            this.celebrationSustainTimer = 0;
            // If user unpinches after viewing the name, allow resetting back to garden
            if (this.celebration.state === 'reveal' && this.celebration.timer > 10.0 && this.bloom < 0.25) {
                this.celebration.reset();
            }
        }

        // --- 3. Canvas Refresh ---
        ctx.clearRect(0, 0, cw, ch);

        // --- 4. Interactive Hand Overlays (Subtle Stardust at fingertips) ---
        this.gestureTracker.drawHandOverlays(ctx, cw, ch, this.lily.currentSpecies);

        // --- 5. Botanical Lily Bouquet Rendering (Stems disappear completely during sequence) ---
        let flowerTip = null;
        if (this.celebration.stemsAlpha > 0.005) {
            ctx.save();
            ctx.globalAlpha = this.celebration.stemsAlpha;
            // During 'expand' phase, scale flower dramatically into full-screen bloom
            const activeGrowth = this.celebration.state === 'expand'
                ? this.growth * this.celebration.expansionScale
                : this.growth;

            flowerTip = this.lily.render(ctx, cw, ch, {
                bloom: this.bloom,
                growth: activeGrowth,
                windForce: totalWind,
                time: this.time
            });
            ctx.restore();
        }

        // --- 6. Pollen Sparkle Emission from Anthers (when flower is visible) ---
        if (flowerTip && this.celebration.stemsAlpha > 0.5 && this.bloom > 0.2) {
            const bloomDelta = Math.abs(this.bloom - this.lastBloomForSparkle);
            if (bloomDelta > 0.008 || Math.abs(totalWind) > 0.25) {
                this.particles.emitPollen(flowerTip, 1);
            }
        }
        this.lastBloomForSparkle = this.bloom;

        // --- 8. Background Drifting Ambient Particles ---
        this.particles.update(totalWind, dt);
        this.particles.draw(ctx, this.lily.currentSpecies);

        // --- 9. Floral Celebration Sequence (Pure Petals & Name Assembly) ---
        this.celebration.update(dt, totalWind, this.time);
        this.celebration.draw(ctx, this.lily.currentSpecies, this.gestureTracker.smoothedFaceBox);

        requestAnimationFrame((ts) => this.renderLoop(ts));
    }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
    window.app = new InteractiveLilyApp();
});
