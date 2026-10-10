/* =============================================================
   GESTURE TRACKING LAYER
   - MediaPipe Hands tracking (pinch for Bloom & Growth, motion for Wind)
   - Ethereal fingertip stardust (no debug/engineering UI)
   - Seamless fallback for mouse/touch
   ============================================================= */

class GestureTracker {
    constructor(videoElement, options = {}) {
        this.video = videoElement;
        this.onTargetsUpdate = options.onTargetsUpdate || (() => {});
        this.onTrackingReady = options.onTrackingReady || (() => {});

        this.hands = null;
        this.camera = null;

        // Current frame hand data
        this.handLandmarks = [];
        this.handHandedness = [];
        this.handsDetected = 0;

        // Smoothing tracking state
        this.targetBloom = 0;
        this.targetGrowth = 0;
        this.targetWind = 0;
        this.prevHandX = 0.5;

        this.initMediaPipe();
    }

    initMediaPipe() {
        if (typeof Hands !== 'undefined') {
            this.hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
            });

            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.65,
                minTrackingConfidence: 0.5,
            });

            this.hands.onResults((results) => this.handleHandResults(results));
        }

        // Fallback timer: ensure experience starts even if camera delayed
        setTimeout(() => {
            this.onTrackingReady();
        }, 1800);

        if (typeof Camera !== 'undefined') {
            try {
                this.camera = new Camera(this.video, {
                    onFrame: async () => {
                        if (this.video.readyState >= 2 && this.hands) {
                            await this.hands.send({ image: this.video });
                        }
                    },
                    width: 1280,
                    height: 720,
                });

                this.camera.start().then(() => {
                    this.onTrackingReady();
                }).catch((err) => {
                    console.warn('Camera start note:', err);
                    this.onTrackingReady();
                });
            } catch (e) {
                console.warn('Camera init note:', e);
                this.onTrackingReady();
            }
        } else {
            this.onTrackingReady();
        }

        // Mouse / Touch fallback when hands are not detected
        window.addEventListener('mousemove', (e) => {
            if (this.handsDetected === 0) {
                const normX = e.clientX / window.innerWidth;
                const dx = normX - this.prevHandX;
                this.targetWind = dx * 10;
                this.prevHandX = normX;

                if (e.buttons === 1) { // Left click drag
                    this.targetBloom = Math.min(1, Math.max(0, 1 - e.clientY / window.innerHeight));
                    this.targetGrowth = Math.min(1, Math.max(0.1, normX));
                }

                this.notifyUpdate();
            }
        });
    }

    handleHandResults(results) {
        this.handLandmarks = results.multiHandLandmarks || [];
        this.handHandedness = results.multiHandedness || [];
        this.handsDetected = this.handLandmarks.length;

        let leftPinch = 0;
        let rightPinch = 0;
        let hasLeft = false;
        let hasRight = false;

        if (this.handsDetected > 0) {
            for (let i = 0; i < this.handsDetected; i++) {
                const hand = this.handLandmarks[i];
                const handedness = this.handHandedness[i];
                const isLeft = handedness && handedness.label === 'Left';
                const pinch = this.calcPinchDistance(hand);

                if (isLeft) {
                    leftPinch = pinch;
                    hasLeft = true;
                } else {
                    rightPinch = pinch;
                    hasRight = true;
                }

                const center = this.palmCenter(hand);
                const dx = center.x - this.prevHandX;
                this.targetWind = dx * 14;
                this.prevHandX = center.x;
            }

            this.targetBloom = hasLeft ? leftPinch : 0;
            this.targetGrowth = hasRight ? rightPinch : 0;
        } else {
            this.targetBloom *= 0.94;
            this.targetGrowth *= 0.94;
            this.targetWind *= 0.88;
        }

        this.notifyUpdate();
    }

    notifyUpdate() {
        this.onTargetsUpdate({
            targetBloom: this.targetBloom,
            targetGrowth: this.targetGrowth,
            targetWind: this.targetWind,
            handsCount: this.handsDetected
        });
    }

    calcPinchDistance(lm) {
        const thumb = lm[4];
        const index = lm[8];
        const wrist = lm[0];
        const mcp = lm[9];

        const ref = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
        if (ref < 0.01) return 0;

        const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
        return Math.min(1, Math.max(0, (dist / ref - 0.15) * 1.6));
    }

    palmCenter(lm) {
        const ids = [0, 5, 9, 13, 17];
        let x = 0, y = 0;
        for (const id of ids) {
            x += lm[id].x;
            y += lm[id].y;
        }
        return { x: x / ids.length, y: y / ids.length };
    }

    /**
     * Subtle, dreamy fingertip aura — no debug UI, no labels, no percentages.
     */
    drawHandOverlays(ctx, cw, ch, currentSpecies) {
        if (!this.handLandmarks || this.handLandmarks.length === 0) return;

        for (let i = 0; i < this.handLandmarks.length; i++) {
            const lm = this.handLandmarks[i];
            const thumbTip = lm[4];
            const indexTip = lm[8];
            if (!thumbTip || !indexTip) continue;

            const tx = thumbTip.x * cw;
            const ty = thumbTip.y * ch;
            const ix = indexTip.x * cw;
            const iy = indexTip.y * ch;

            ctx.save();
            ctx.globalCompositeOperation = 'screen';

            const auraColor = currentSpecies.accentColor || '#58a6ff';

            for (const pt of [{ x: tx, y: ty }, { x: ix, y: iy }]) {
                const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 14);
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
                grad.addColorStop(0.35, auraColor);
                grad.addColorStop(1, 'transparent');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }
}

window.GestureTracker = GestureTracker;
