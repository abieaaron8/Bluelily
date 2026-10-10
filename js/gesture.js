/* =============================================================
   GESTURE TRACKING LAYER
   - MediaPipe Hands tracking (pinch = Bloom & Growth, motion = Wind)
   - One Euro adaptive filtering on every landmark
   - Verified handedness (labels vs. real geometry, self-calibrating)
   - Hold-and-decay when a hand drops out (never snaps to zero)
   - Per-hand wind from real velocity over real time
   - Ethereal fingertip stardust (no debug / engineering UI)
   - Mouse fallback that shares the same velocity model

   Public API (unchanged):
     new GestureTracker(video, { onTargetsUpdate, onTrackingReady })
     .handLandmarks / .handHandedness / .handsDetected
     .drawHandOverlays(ctx, cw, ch, species)
     .smoothedFaceBox (kept for compatibility, always null)
   New (additive):
     .getTargets()  -> { bloom, growth, wind, handsCount }
   ============================================================= */

const GESTURE_CONFIG = Object.freeze({
    // Pose the garden relaxes toward when nobody is controlling it
    rest: { bloom: 0.15, growth: 0.45 },

    // Dropout handling (seconds)
    holdTime: 0.22,        // keep last value this long after a hand vanishes
    decayTau: 0.9,         // then relax toward rest with this time constant
    reacquireGap: 0.6,     // longer than this = treat as a brand-new hand

    // One Euro parameters (landmarks are normalised 0..1 coordinates)
    landmarkFilter: { minCutoff: 1.4, beta: 10.0, dCutoff: 1.0 },
    pinchFilter: { minCutoff: 1.8, beta: 2.5, dCutoff: 1.0 },

    // Wind model: velocity in normalised-screen-widths per second
    wind: {
        velocityTau: 0.09,     // low-pass on palm velocity
        deadzone: 0.05,        // ignore residual tracking noise
        maxRawVelocity: 5.0,
        lossTau: 0.18,         // velocity fades this fast if the hand is lost
        gain: 0.5,             // velocity -> wind force
        max: 1.6               // soft saturation of the combined force
    },

    // Single-hand slot continuity (normalised distance)
    continuityRadius: 0.18,
    continuityWindow: 0.5,

    // Fingertip overlay fades (seconds)
    overlay: { fadeOutStart: 0.08, fadeOutEnd: 0.35, fadeIn: 0.18 }
});

const PALM_IDS = [0, 5, 9, 13, 17];

/**
 * One physical hand (the user's real left or right), with its own filters,
 * last-known values and wind velocity.
 */
class HandSlot {
    constructor(name) {
        this.name = name;
        const L = GESTURE_CONFIG.landmarkFilter;
        const P = GESTURE_CONFIG.pinchFilter;
        this.fx = Array.from({ length: 21 }, () => new OneEuroFilter(L.minCutoff, L.beta, L.dCutoff));
        this.fy = Array.from({ length: 21 }, () => new OneEuroFilter(L.minCutoff, L.beta, L.dCutoff));
        this.pinchFilter = new OneEuroFilter(P.minCutoff, P.beta, P.dCutoff);

        this.lm = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })); // filtered
        this.rawPalm = { x: 0.5, y: 0.5 };
        this.pinch = 0;

        this.everSeen = false;
        this.lastSeen = -Infinity;
        this.streakStart = -Infinity;

        this.prevPalmX = null;
        this.windVel = 0;
    }

    isActive(now) {
        return this.everSeen && (now - this.lastSeen) <= GESTURE_CONFIG.holdTime;
    }

    ingest(rawLm, rawPalm, now) {
        const gap = now - this.lastSeen;
        const fresh = !(gap <= GESTURE_CONFIG.reacquireGap);
        const dt = fresh ? 1 / 30 : MathUtils.clamp(gap, 1 / 240, 0.2);

        if (fresh) {
            for (let i = 0; i < 21; i++) {
                this.fx[i].reset();
                this.fy[i].reset();
            }
            this.pinchFilter.reset();
            this.streakStart = now;
            this.prevPalmX = null;
            this.windVel = 0;
        }

        // 1. Adaptive filtering of every landmark
        for (let i = 0; i < 21; i++) {
            const p = rawLm[i];
            const o = this.lm[i];
            o.x = this.fx[i].filter(p.x, dt);
            o.y = this.fy[i].filter(p.y, dt);
            o.z = p.z || 0;
        }
        this.rawPalm.x = rawPalm.x;
        this.rawPalm.y = rawPalm.y;

        // 2. Pinch, measured on filtered landmarks, lightly filtered again
        const rawPinch = this.measurePinch();
        if (rawPinch !== null) {
            this.pinch = this.pinchFilter.filter(rawPinch, dt);
        }

        // 3. Real horizontal palm velocity (units / second)
        let sx = 0;
        for (const id of PALM_IDS) sx += this.lm[id].x;
        const palmX = sx / PALM_IDS.length;

        if (this.prevPalmX !== null) {
            const W = GESTURE_CONFIG.wind;
            const vRaw = MathUtils.clamp((palmX - this.prevPalmX) / dt, -W.maxRawVelocity, W.maxRawVelocity);
            const a = 1 - Math.exp(-dt / W.velocityTau);
            this.windVel += (vRaw - this.windVel) * a;
        }
        this.prevPalmX = palmX;

        this.everSeen = true;
        this.lastSeen = now;
    }

    /** Same mapping as before; returns null (hold) if the hand is degenerate. */
    measurePinch() {
        const lm = this.lm;
        const ref = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y);
        if (ref < 0.01) return null;
        const dist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
        return MathUtils.clamp((dist / ref - 0.15) * 1.6, 0, 1);
    }

    /** Last pinch while present, held briefly, then eased toward rest. */
    heldPinch(now, rest) {
        if (!this.everSeen) return rest;
        const gap = Math.max(0, now - this.lastSeen);
        const C = GESTURE_CONFIG;
        if (gap <= C.holdTime) return this.pinch;
        return rest + (this.pinch - rest) * Math.exp(-(gap - C.holdTime) / C.decayTau);
    }

    /** Signed wind contribution (dead-zoned, fades quickly if hand is lost). */
    windContribution(now) {
        if (!this.everSeen) return 0;
        const W = GESTURE_CONFIG.wind;
        const gap = Math.max(0, now - this.lastSeen);
        const v = this.windVel * Math.exp(-gap / W.lossTau);
        const a = Math.abs(v) - W.deadzone;
        return a > 0 ? Math.sign(v) * a : 0;
    }
}

class GestureTracker {
    constructor(videoElement, options = {}) {
        this.video = videoElement;
        this.onTargetsUpdate = options.onTargetsUpdate || (() => { });
        this.onTrackingReady = options.onTrackingReady || (() => { });

        this.hands = null;
        this.camera = null;

        // Public, compatibility state
        this.handLandmarks = [];
        this.handHandedness = [];
        this.handsDetected = 0;
        this.smoothedFaceBox = null;
        this.targetBloom = GESTURE_CONFIG.rest.bloom;
        this.targetGrowth = GESTURE_CONFIG.rest.growth;
        this.targetWind = 0;

        // Physical hands (user's real left / right)
        this.slots = { left: new HandSlot('left'), right: new HandSlot('right') };

        // Handedness calibration. MediaPipe assumes a mirrored (selfie) image,
        // but we feed it the raw camera frame, so the labels arrive swapped.
        // This is the documented default and is verified at runtime against
        // real hand geometry whenever two hands are visible.
        this.swapLabels = true;
        this.labelVotes = { swap: 0, keep: 0 };

        // Mouse fallback (shares the same velocity model as hands)
        this.pointer = {
            bloom: GESTURE_CONFIG.rest.bloom,
            growth: GESTURE_CONFIG.rest.growth,
            lastX: null,
            lastT: 0,
            vel: 0,
            lastMove: -Infinity,
            lastInteraction: -Infinity
        };

        this.initMediaPipe();
    }

    now() {
        return performance.now() / 1000;
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

        this.initPointerFallback();
    }

    // ---------------------------------------------------------
    // Mouse fallback
    // ---------------------------------------------------------
    initPointerFallback() {
        window.addEventListener('mousemove', (e) => {
            const now = this.now();

            // Real hands always win over the mouse
            if (this.slots.left.isActive(now) || this.slots.right.isActive(now)) return;

            const P = this.pointer;
            const normX = e.clientX / window.innerWidth;

            if (P.lastX !== null) {
                const dt = MathUtils.clamp(now - P.lastT, 1 / 240, 0.1);
                const W = GESTURE_CONFIG.wind;
                const vRaw = MathUtils.clamp((normX - P.lastX) / dt, -W.maxRawVelocity, W.maxRawVelocity);
                const a = 1 - Math.exp(-dt / W.velocityTau);
                P.vel += (vRaw - P.vel) * a;
            }
            P.lastX = normX;
            P.lastT = now;
            P.lastMove = now;
            P.lastInteraction = now;

            if (e.buttons === 1) { // Left click drag
                P.bloom = MathUtils.clamp(1 - e.clientY / window.innerHeight, 0, 1);
                P.growth = MathUtils.clamp(normX, 0.1, 1);
            }

            this.notifyUpdate();
        });
    }

    // ---------------------------------------------------------
    // MediaPipe results -> physical hands
    // ---------------------------------------------------------
    handleHandResults(results) {
        const now = this.now();
        const lmList = results.multiHandLandmarks || [];
        const labels = results.multiHandedness || [];

        const hands = lmList.map((lm, i) => ({
            lm,
            label: labels[i] ? labels[i].label : null,
            palm: this.palmCenter(lm)
        }));

        const assigned = this.assignSlots(hands, now);
        for (const { slot, hand } of assigned) {
            slot.ingest(hand.lm, hand.palm, now);
        }

        this.handHandedness = labels;
        this.notifyUpdate();
    }

    /**
     * Decide which physical hand each detection is.
     *  - Two hands: geometry decides (in the raw camera frame the user's LEFT
     *    hand has the larger x). Labels are only used to verify calibration.
     *  - One hand: continuity with a recently active slot wins, otherwise the
     *    (calibrated) MediaPipe label.
     */
    assignSlots(hands, now) {
        if (hands.length === 0) return [];

        if (hands.length >= 2) {
            const sorted = hands.slice(0, 2).sort((a, b) => b.palm.x - a.palm.x);
            const [geoLeft, geoRight] = sorted;
            this.learnLabelOrientation(geoLeft, geoRight);
            return [
                { slot: this.slots.left, hand: geoLeft },
                { slot: this.slots.right, hand: geoRight }
            ];
        }

        const hand = hands[0];
        const C = GESTURE_CONFIG;

        // Continuity: is this the same hand we were already tracking?
        let best = null;
        let bestDist = C.continuityRadius;
        for (const slot of [this.slots.left, this.slots.right]) {
            if (!slot.everSeen || (now - slot.lastSeen) > C.continuityWindow) continue;
            const d = Math.hypot(hand.palm.x - slot.rawPalm.x, hand.palm.y - slot.rawPalm.y);
            if (d < bestDist) {
                bestDist = d;
                best = slot;
            }
        }
        if (best) return [{ slot: best, hand }];

        return [{ slot: this.slotFromLabel(hand.label), hand }];
    }

    slotFromLabel(label) {
        const isLabelLeft = label === 'Left';
        const userIsLeft = this.swapLabels ? !isLabelLeft : isLabelLeft;
        return userIsLeft ? this.slots.left : this.slots.right;
    }

    /** Confirms (or corrects) the label swap using two-hand geometry. */
    learnLabelOrientation(geoLeft, geoRight) {
        if (!geoLeft.label || !geoRight.label || geoLeft.label === geoRight.label) return;
        if (geoLeft.label === 'Right') this.labelVotes.swap++;
        else this.labelVotes.keep++;

        const total = this.labelVotes.swap + this.labelVotes.keep;
        if (total >= 8) {
            this.swapLabels = this.labelVotes.swap >= this.labelVotes.keep;
        }
    }

    palmCenter(lm) {
        let x = 0, y = 0;
        for (const id of PALM_IDS) {
            x += lm[id].x;
            y += lm[id].y;
        }
        return { x: x / PALM_IDS.length, y: y / PALM_IDS.length };
    }

    // ---------------------------------------------------------
    // Targets (pulled every frame by the render loop)
    // ---------------------------------------------------------
    /**
     * Pure function of time: hold-and-decay and wind fade-out keep evolving
     * even if the camera stalls and no results arrive.
     */
    getTargets(now = this.now()) {
        const C = GESTURE_CONFIG;
        const { left, right } = this.slots;
        const P = this.pointer;

        const lastHand = Math.max(left.lastSeen, right.lastSeen);
        const pointerMode = P.lastInteraction > lastHand;

        let bloom, growth, windRaw;
        if (pointerMode) {
            bloom = P.bloom;
            growth = P.growth;
            const v = P.vel * Math.exp(-(now - P.lastMove) / C.wind.lossTau);
            const a = Math.abs(v) - C.wind.deadzone;
            windRaw = a > 0 ? Math.sign(v) * a : 0;
        } else {
            bloom = left.heldPinch(now, C.rest.bloom);     // left hand  -> bloom
            growth = right.heldPinch(now, C.rest.growth);  // right hand -> growth
            windRaw = left.windContribution(now) + right.windContribution(now);
        }

        // Soft saturation: two hands can't stack into an unphysical gale
        const W = C.wind;
        const wind = W.max * Math.tanh((windRaw * W.gain) / W.max);

        // Public compatibility state
        this.handLandmarks.length = 0;
        if (left.isActive(now)) this.handLandmarks.push(left.lm);
        if (right.isActive(now)) this.handLandmarks.push(right.lm);
        this.handsDetected = this.handLandmarks.length;

        this.targetBloom = bloom;
        this.targetGrowth = growth;
        this.targetWind = wind;

        return { bloom, growth, wind, handsCount: this.handsDetected };
    }

    notifyUpdate() {
        const t = this.getTargets();
        this.onTargetsUpdate({
            targetBloom: t.bloom,
            targetGrowth: t.growth,
            targetWind: t.wind,
            handsCount: t.handsCount
        });
    }

    // ---------------------------------------------------------
    // Fingertip aura
    // ---------------------------------------------------------
    /**
     * Subtle, dreamy fingertip aura. Uses the filtered landmarks, fades in
     * when a hand appears and fades out gracefully during dropouts.
     * (cw / ch are logical CSS pixels; the context carries the DPR transform.)
     */
    drawHandOverlays(ctx, cw, ch, currentSpecies) {
        const now = this.now();
        const O = GESTURE_CONFIG.overlay;
        const auraColor = currentSpecies.accentColor || '#58a6ff';

        for (const slot of [this.slots.left, this.slots.right]) {
            if (!slot.everSeen) continue;
            const gap = now - slot.lastSeen;
            if (gap > O.fadeOutEnd) continue;

            const alpha = (1 - MathUtils.smoothstep(O.fadeOutStart, O.fadeOutEnd, gap))
                * MathUtils.smoothstep(0, O.fadeIn, now - slot.streakStart);
            if (alpha < 0.01) continue;

            const thumbTip = slot.lm[4];
            const indexTip = slot.lm[8];

            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = alpha;

            for (const tip of [thumbTip, indexTip]) {
                const px = tip.x * cw;
                const py = tip.y * ch;
                const grad = ctx.createRadialGradient(px, py, 0, px, py, 14);
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
                grad.addColorStop(0.35, auraColor);
                grad.addColorStop(1, 'transparent');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(px, py, 14, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }
}

window.GestureTracker = GestureTracker;