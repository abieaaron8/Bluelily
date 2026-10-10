/* =============================================================
   ORGANIC NOISE, MOTION & SIGNAL UTILITIES
   - OrganicNoise   : multi-octave smooth noise (unchanged)
   - MathUtils      : clamp / lerp / easing helpers (unchanged)
   - Spring         : exact, frame-rate independent damped spring
   - OneEuroFilter  : adaptive low-pass filter for noisy tracking
   ============================================================= */

class OrganicNoise {
    constructor() {
        this.seeds = Array.from({ length: 16 }, () => Math.random() * 10000);
    }

    /**
     * Layered harmonic noise roughly in [-1, 1]
     * @param {number} t - Time coordinate
     * @param {number} channel - Distinct random channel index
     */
    get(t, channel = 0) {
        const s = this.seeds[channel % this.seeds.length];
        return (
            Math.sin(t * 0.72 + s) * 0.40 +
            Math.sin(t * 1.37 + s * 1.63) * 0.28 +
            Math.sin(t * 2.21 + s * 0.47) * 0.18 +
            Math.sin(t * 3.89 + s * 2.11) * 0.10 +
            Math.sin(t * 5.43 + s * 3.19) * 0.04
        );
    }

    /**
     * 2D smooth noise for micro-jitter and fluttering
     */
    get2D(x, y, channel = 0) {
        const s = this.seeds[channel % this.seeds.length];
        return (
            Math.sin(x * 1.1 + y * 0.7 + s) * 0.5 +
            Math.cos(x * 0.8 - y * 1.3 + s * 1.5) * 0.5
        );
    }
}

/**
 * Utility clamping and interpolation helpers
 */
const MathUtils = {
    clamp(val, min = 0, max = 1) {
        return Math.max(min, Math.min(max, val));
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    // Smoothstep easing (0 to 1)
    smoothstep(min, max, value) {
        const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
        return x * x * (3 - 2 * x);
    },

    // Ease-out cubic
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
};

/**
 * Damped harmonic spring solved with its CLOSED-FORM solution.
 *
 * Because the solution is analytic (not numerically integrated), the result
 * after a given amount of real time is the same whether it is reached in one
 * step or in a hundred: 60 Hz, 144 Hz and a dropped frame all produce the
 * same motion, and the spring can never go unstable at large dt.
 *
 *   omega : natural frequency in rad/s. Higher = snappier, lighter.
 *           Settling time is roughly 4.6 / omega for zeta = 1.
 *   zeta  : damping ratio. 1 = critically damped (fastest approach with no
 *           overshoot). < 1 = underdamped (overshoots and settles).
 */
class Spring {
    constructor(value = 0, { omega = 6, zeta = 1 } = {}) {
        this.value = value;
        this.velocity = 0;
        this.target = value;
        this.omega = omega;
        this.zeta = zeta;
    }

    setTarget(target) {
        this.target = target;
    }

    snap(value) {
        this.value = value;
        this.target = value;
        this.velocity = 0;
    }

    update(dt) {
        if (!(dt > 0)) return this.value;

        const w = this.omega;
        const z = this.zeta;
        const x0 = this.value - this.target;
        const v0 = this.velocity;

        if (z >= 0.9999) {
            // Critically damped: x(t) = (x0 + (v0 + w*x0) t) e^(-wt)
            const e = Math.exp(-w * dt);
            const c = v0 + w * x0;
            this.value = this.target + (x0 + c * dt) * e;
            this.velocity = (v0 - c * w * dt) * e;
        } else {
            // Underdamped: decaying oscillation around the target
            const zw = z * w;
            const wd = w * Math.sqrt(1 - z * z);
            const e = Math.exp(-zw * dt);
            const cs = Math.cos(wd * dt);
            const sn = Math.sin(wd * dt);
            const b = (v0 + zw * x0) / wd;
            this.value = this.target + e * (x0 * cs + b * sn);
            this.velocity = e * ((-zw * x0 + wd * b) * cs + (-zw * b - wd * x0) * sn);
        }
        return this.value;
    }
}

/**
 * One Euro Filter (Casiez, Roussel & Vogel, CHI 2012).
 * A low-pass filter whose cutoff rises with signal speed:
 *   - hand nearly still  -> low cutoff  -> heavy smoothing, no jitter
 *   - hand moving fast   -> high cutoff -> light smoothing, no lag
 * dt is supplied per sample, so uneven camera frame timing is handled.
 */
class OneEuroFilter {
    constructor(minCutoff = 1.0, beta = 0.0, dCutoff = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.reset();
    }

    reset() {
        this.hasPrev = false;
        this.xPrev = 0;
        this.dxPrev = 0;
    }

    static alpha(cutoff, dt) {
        const tau = 1 / (2 * Math.PI * cutoff);
        return 1 / (1 + tau / dt);
    }

    filter(x, dt) {
        if (!this.hasPrev) {
            this.hasPrev = true;
            this.xPrev = x;
            this.dxPrev = 0;
            return x;
        }
        dt = Math.max(dt, 1e-4);

        // Smoothed speed estimate
        const dx = (x - this.xPrev) / dt;
        this.dxPrev += (dx - this.dxPrev) * OneEuroFilter.alpha(this.dCutoff, dt);

        // Speed-adaptive cutoff
        const cutoff = this.minCutoff + this.beta * Math.abs(this.dxPrev);
        this.xPrev += (x - this.xPrev) * OneEuroFilter.alpha(cutoff, dt);
        return this.xPrev;
    }
}

window.OrganicNoise = OrganicNoise;
window.MathUtils = MathUtils;
window.Spring = Spring;
window.OneEuroFilter = OneEuroFilter;