/* =============================================================
   APPLICATION ORCHESTRATOR (Phase 4 Zero-GC & State-Batched)
   Integrates GestureTracker, LilyRenderer, ParticleSystem,
   CelebrationManager, and UIManager.

   Motion foundation:
   - Real-time delta (seconds) drives everything: identical speed on
     60 / 120 / 144 Hz displays.
   - Bloom, growth and wind are exact damped springs, not lerps.
   - Canvas backing store is devicePixelRatio aware (logical CSS-pixel
     coordinates are preserved for every other module).
   ============================================================= */

// Spring tuning: omega = responsiveness (rad/s), zeta = damping ratio.
// zeta = 1 is critically damped: fastest approach with zero overshoot.
const MOTION_CONFIG = Object.freeze({
    bloom: { omega: 7.5, zeta: 1.0 },   // petals: light, quick, no bounce
    growth: { omega: 4.5, zeta: 1.0 },   // stem: heavier, slower to commit
    wind: { omega: 5.5, zeta: 0.62 },   // air is a pendulum: sways past, then settles
    maxDt: 0.05,                          // clamp after tab switches / hitches
    maxDpr: 2,                            // cap backing-store cost on 3x phones
    pollenRate: 45,                       // pollen puffs / second while flower is active
    pollenActivitySpeed: 0.48             // bloom units / second that counts as activity
});

class InteractiveLilyApp {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('webcam');

        // Logical (CSS pixel) viewport + pixel ratio
        this.dpr = 1;
        this.viewW = window.innerWidth;
        this.viewH = window.innerHeight;
        this.needsResize = true;

        // Core systems
        this.noise = new OrganicNoise();
        this.particles = new ParticleSystem(this.viewW, this.viewH);
        this.lily = new LilyRenderer();
        this.celebration = new CelebrationManager();

        // Springs (initial values preserve the original opening feel)
        this.springs = {
            bloom: new Spring(0, MOTION_CONFIG.bloom),
            growth: new Spring(0.28, MOTION_CONFIG.growth),
            wind: new Spring(0, MOTION_CONFIG.wind)
        };
        this.springs.bloom.setTarget(0.15);
        this.springs.growth.setTarget(0.45);

        // Visible, spring-driven state (read by renderer & celebration logic)
        this.bloom = this.springs.bloom.value;
        this.growth = this.springs.growth.value;
        this.windForce = 0;

        // Detection targets from gestures
        this.targetBloom = 0.15;
        this.targetGrowth = 0.45;
        this.targetWind = 0;

        // Time tracking (seconds)
        this.time = 0;
        this.lastTimestamp = 0;
        this.lastBloomForSparkle = 0;
        this.pollenBudget = 0;
        this.celebrationSustainTimer = 0;
        this.lastHandsCount = -1;

        // Pre-allocated render state payload (0 B/frame allocation)
        this.renderState = {
            bloom: 0,
            growth: 0,
            windForce: 0,
            time: 0
        };

        // Bound rAF callback instance (0 closure allocations/frame)
        this.boundRenderLoop = (ts) => this.renderLoop(ts);

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

        // Resize + DPR change handling (applied once per frame, not per event)
        window.addEventListener('resize', () => { this.needsResize = true; });
        this.watchDevicePixelRatio();
        this.resize();

        // Gesture Tracker (MediaPipe). Targets are pulled every frame via
        // getTargets(); the callback only keeps the status badge responsive.
        this.gestureTracker = new GestureTracker(this.video, {
            onTrackingReady: () => {
                this.cameraReady = true;
                this.checkDismissLoading();
            },
            onTargetsUpdate: (data) => {
                this.syncTrackingStatus(data.handsCount);
            }
        });

        // Start render loop
        requestAnimationFrame(this.boundRenderLoop);
    }

    checkDismissLoading() {
        if (this.cameraReady && this.minLoadingElapsed) {
            this.ui.setLoadingComplete();
        }
    }

    syncTrackingStatus(handsCount) {
        if (handsCount === this.lastHandsCount) return;
        this.lastHandsCount = handsCount;
        this.ui.updateTrackingStatus(handsCount);
    }

    /** Re-arms a one-shot media query so zoom / monitor moves update DPR. */
    watchDevicePixelRatio() {
        if (!window.matchMedia) return;
        const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        const onChange = () => {
            this.needsResize = true;
            this.watchDevicePixelRatio();
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange, { once: true });
        else if (mq.addListener) mq.addListener(onChange);
    }

    resize() {
        this.needsResize = false;
        this.dpr = Math.min(window.devicePixelRatio || 1, MOTION_CONFIG.maxDpr);
        this.viewW = window.innerWidth;
        this.viewH = window.innerHeight;

        const pw = Math.round(this.viewW * this.dpr);
        const ph = Math.round(this.viewH * this.dpr);
        if (this.canvas.width !== pw) this.canvas.width = pw;
        if (this.canvas.height !== ph) this.canvas.height = ph;

        // Every other module keeps working in logical CSS pixels
        this.particles.resize(this.viewW, this.viewH);
    }

    renderLoop(timestamp) {
        if (this.needsResize) this.resize();

        // --- 0. Real elapsed time in seconds, independent of refresh rate ---
        let dtSec = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 1 / 60;
        this.lastTimestamp = timestamp;
        dtSec = MathUtils.clamp(dtSec, 0, MOTION_CONFIG.maxDt);
        this.time += dtSec;

        const dtFrames = dtSec * 60;
        const ctx = this.ctx;
        const cw = this.viewW;
        const ch = this.viewH;

        // --- 1. Pull gesture targets, then advance the springs ---
        const t = this.gestureTracker.getTargets();
        this.syncTrackingStatus(t.handsCount);

        this.targetBloom = t.bloom;
        this.targetGrowth = Math.max(0.1, t.growth);
        this.targetWind = t.wind;

        const { bloom: sBloom, growth: sGrowth, wind: sWind } = this.springs;
        sBloom.setTarget(this.targetBloom);
        sGrowth.setTarget(this.targetGrowth);
        sWind.setTarget(this.targetWind);

        sBloom.update(dtSec);
        sGrowth.update(dtSec);
        sWind.update(dtSec);

        this.bloom = MathUtils.clamp(sBloom.value, 0, 1);
        this.growth = MathUtils.clamp(sGrowth.value, 0, 1);
        this.windForce = sWind.value;

        // Ambient gentle atmospheric breeze
        const naturalBreeze = this.noise.get(this.time * 0.7, 1) * 0.14;
        const totalWind = naturalBreeze + this.windForce * 0.22;

        // --- 2. Check Celebration Trigger Threshold ---
        if (this.bloom >= 0.84 && this.celebration.state === 'idle') {
            this.celebrationSustainTimer += dtSec;
            if (this.celebrationSustainTimer > 0.35) {
                this.celebration.trigger();
            }
        } else if (this.bloom < 0.70) {
            this.celebrationSustainTimer = 0;
            if (this.celebration.state === 'reveal' && this.celebration.timer > 10.0 && this.bloom < 0.25) {
                this.celebration.reset();
            }
        }

        // --- 3. Canvas Refresh & Transform Setup ---
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        // --- 4. Interactive Hand Overlays ---
        this.gestureTracker.drawHandOverlays(ctx, cw, ch, this.lily.currentSpecies);

        // --- 5. Botanical Lily Bouquet Rendering (Zero-GC state reuse) ---
        let flowerTip = null;
        const stemsAlpha = this.celebration.stemsAlpha;
        if (stemsAlpha > 0.005) {
            const activeGrowth = this.celebration.state === 'expand'
                ? this.growth * this.celebration.expansionScale
                : this.growth;

            // Reuse persistent renderState object
            const state = this.renderState;
            state.bloom = this.bloom;
            state.growth = activeGrowth;
            state.windForce = totalWind;
            state.time = this.time;

            if (stemsAlpha < 0.999) {
                ctx.globalAlpha = stemsAlpha;
                flowerTip = this.lily.render(ctx, cw, ch, state);
                ctx.globalAlpha = 1.0;
            } else {
                flowerTip = this.lily.render(ctx, cw, ch, state);
            }
        }

        // --- 6. Pollen Sparkle Emission from Anthers ---
        const bloomSpeed = dtSec > 1e-4
            ? Math.abs(this.bloom - this.lastBloomForSparkle) / dtSec
            : 0;
        this.lastBloomForSparkle = this.bloom;

        if (flowerTip && stemsAlpha > 0.5 && this.bloom > 0.2) {
            if (bloomSpeed > MOTION_CONFIG.pollenActivitySpeed || Math.abs(totalWind) > 0.25) {
                this.pollenBudget += MOTION_CONFIG.pollenRate * dtSec;
            }
            const puffs = Math.floor(this.pollenBudget);
            if (puffs > 0) {
                this.particles.emitPollen(flowerTip, puffs);
                this.pollenBudget -= puffs;
            }
        }
        this.pollenBudget = Math.min(this.pollenBudget, 4);

        // --- 7. Background Drifting Ambient Particles ---
        this.particles.update(totalWind, dtFrames);
        this.particles.draw(ctx, this.lily.currentSpecies);

        // --- 8. Floral Celebration Sequence ---
        this.celebration.update(dtFrames, totalWind, this.time);
        this.celebration.draw(ctx, this.lily.currentSpecies, this.gestureTracker.smoothedFaceBox);

        requestAnimationFrame(this.boundRenderLoop);
    }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
    window.app = new InteractiveLilyApp();
});