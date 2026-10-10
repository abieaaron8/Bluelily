/* =============================================================
   ORGANIC NOISE & MATH UTILITIES
   Multi-octave smooth noise and spring interpolation for
   botanically realistic movement and organic wind response.
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

window.OrganicNoise = OrganicNoise;
window.MathUtils = MathUtils;
