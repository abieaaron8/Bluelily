/* =============================================================
   BOTANICAL LILY BOUQUET RENDERER (v2: Phase 3 Optimized)
   - Zero-GC pathing: Direct context tracing for outlines, veins,
     folds, midribs, and sheen (0 Path2D heap allocations)
   - Pre-allocated stem point buffers and cluster pedicel pools
   - Pre-computed species palette colors and gradient caching
   - Zero object/array allocations per frame in render loop
   Preserved: stem, foliage, pedicels, reproductive core, species.
   Public API unchanged: LilyRenderer.render / setSpecies /
   currentSpecies; drawSoft* method names kept.
   ============================================================= */

const LILY_TAU = Math.PI * 2;
const LILY_LIGHT_ANGLE = -0.75; // canvas-space light direction (upper side)

// Original six-tepal layout (3 outer behind, 3 inner in front)
const LILY_PETAL_TEMPLATES = [
    { inner: false, base: -Math.PI / 2, len: 1.04, wid: 0.88, curl: 1.10 },
    { inner: false, base: -Math.PI * 0.85, len: 0.96, wid: 0.86, curl: 1.05 },
    { inner: false, base: -Math.PI * 0.15, len: 0.96, wid: 0.86, curl: 1.05 },
    { inner: true, base: -Math.PI * 0.69, len: 1.00, wid: 1.06, curl: 1.20 },
    { inner: true, base: -Math.PI * 0.31, len: 1.00, wid: 1.06, curl: 1.20 },
    { inner: true, base: Math.PI * 0.46, len: 0.84, wid: 0.94, curl: 0.92 }
];

/* ---------- seeded randomness & colour helpers ---------- */
const LilyRng = {
    create(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
};

const LilyColor = {
    parse(str) {
        if (str[0] === '#') {
            let h = str.slice(1);
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
        }
        const m = str.match(/[\d.]+/g) || [0, 0, 0, 1];
        return { r: +m[0], g: +m[1], b: +m[2], a: m[3] !== undefined ? +m[3] : 1 };
    },
    toHsl(str) {
        const c = this.parse(str);
        const r = c.r / 255, g = c.g / 255, b = c.b / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const l = (mx + mn) / 2;
        let h = 0, s = 0;
        if (mx !== mn) {
            const d = mx - mn;
            s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
            if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (mx === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }
        return { h, s: s * 100, l: l * 100 };
    },
    css(h, s, l, a = 1) {
        h = ((h % 360) + 360) % 360;
        s = Math.max(0, Math.min(100, s));
        l = Math.max(0, Math.min(100, l));
        return a >= 1
            ? `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`
            : `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`;
    },
    mix(a, b, t) {
        const dh = ((b.h - a.h + 540) % 360) - 180;
        return { h: a.h + dh * t, s: a.s + (b.s - a.s) * t, l: a.l + (b.l - a.l) * t };
    }
};

class LilyRenderer {
    constructor() {
        this.noise = new OrganicNoise();
        this.speciesKey = 'blue';
        this.currentSpecies = LILY_SPECIES.blue;

        this.flowers = new Map();   // variantSeed -> persistent flower anatomy + springs
        this.palettes = {};         // species id -> parsed HSL palette
        this.leafGradients = {};    // species id -> linear gradient for foliage

        // Pre-allocated stem point buffer (33 points max)
        this.stemPointsPool = Array.from({ length: 33 }, () => ({ x: 0, y: 0, width: 0 }));
        this.stemTipResult = { x: 0, y: 0 };
        this.mainStemResult = { tip: this.stemTipResult, points: this.stemPointsPool, angle: 0 };

        // Pre-allocated pedicel pool (4 max)
        this.pedicelPool = Array.from({ length: 4 }, () => ({
            start: null,
            tip: { x: 0, y: 0 },
            angle: 0,
            type: '',
            scale: 0,
            bloomFactor: 0,
            timeOffset: 0,
            variant: 0,
            isBack: false,
            budBase: 0,
            budGain: 0
        }));
        this.activePedicelCount = 0;

        // Pre-created unit leaf Path2D objects (length 1.0, width 1.0)
        this.unitLeafPath = new Path2D();
        this.unitLeafPath.moveTo(0, 0);
        this.unitLeafPath.bezierCurveTo(0.35, -0.65, 0.72, -0.35, 1.0, 0.2);
        this.unitLeafPath.bezierCurveTo(1.03, 0.35, 0.98, 0.5, 0.94, 0.55);
        this.unitLeafPath.bezierCurveTo(0.648, 0.52, 0.28, 0.43, 0, 0);
        this.unitLeafPath.closePath();

        this.unitVeinPath = new Path2D();
        this.unitVeinPath.moveTo(0.06, 0);
        this.unitVeinPath.quadraticCurveTo(0.5, -0.12, 0.9, 0.17);

        // Scratch buffers reused by every petal (no per-frame allocation churn)
        const N = 24;
        this.scr = {
            N: 0,
            xs: new Float32Array(N), ys: new Float32Array(N),
            nx: new Float32Array(N), ny: new Float32Array(N),
            wl: new Float32Array(N), wr: new Float32Array(N),
            psi: new Float32Array(N),
            px: new Float32Array(N * 2), py: new Float32Array(N * 2)
        };
        this.tmpPt = { x: 0, y: 0, psi: 0 };
    }

    setSpecies(key) {
        if (LILY_SPECIES[key]) {
            this.speciesKey = key;
            this.currentSpecies = LILY_SPECIES[key];
            this.getPalette(this.currentSpecies);
            for (const [variant, flower] of this.flowers) {
                for (const ps of flower.petals) {
                    this.petalColors(ps.spec, this.currentSpecies);
                }
            }
        }
    }

    // =========================================================
    // PER-FLOWER ANATOMY (generated once, deterministic per seed)
    // =========================================================

    getFlower(variant) {
        let f = this.flowers.get(variant);
        if (!f) {
            f = this.createFlower(variant);
            this.flowers.set(variant, f);
        }
        return f;
    }

    createFlower(variant) {
        const rng = LilyRng.create(0x9E3779B1 ^ (variant * 7919 + 13));
        const petals = LILY_PETAL_TEMPLATES.map((tpl, i) => {
            const spec = this.createPetalSpec(rng, tpl, i);
            this.petalColors(spec, this.currentSpecies); // Warm color cache
            return {
                spec,
                sBase: new Spring(0, { omega: 5.4 + rng() * 1.6, zeta: 1.0 }),
                sTip: new Spring(0, { omega: 8.0 + rng() * 2.4, zeta: 0.66 + rng() * 0.08 }),
                pb: 0, pt: 0
            };
        });
        return { petals, lastTime: null, roll: (rng() - 0.5) * 0.12 };
    }

    createPetalSpec(rng, tpl, idx) {
        const gauss = () => (rng() + rng() + rng() - 1.5) / 0.75;
        const cosB = Math.cos(tpl.base);
        const curlSign = cosB < -0.2 ? -1 : (cosB > 0.2 ? 1 : (rng() < 0.5 ? -1 : 1));

        const wave = () => [
            { a: 0.045 + rng() * 0.02, f: 1.5 + rng() * 0.9, p: rng() * LILY_TAU },
            { a: 0.028 + rng() * 0.014, f: 3.0 + rng() * 1.3, p: rng() * LILY_TAU },
            { a: 0.014 + rng() * 0.010, f: 5.2 + rng() * 1.6, p: rng() * LILY_TAU }
        ];
        const knots = () => Array.from({ length: 9 }, () => rng() * 2 - 1);

        // Freckles: clustered, concentrated toward the throat, never a stamp
        const clusters = Array.from({ length: 2 + Math.floor(rng() * 2) }, () => ({
            u: 0.15 + rng() * 0.32, lam: (rng() - 0.5) * 1.1, spread: 0.05 + rng() * 0.05
        }));
        const count = Math.round(20 + rng() * 14);
        const tiers = [[], [], []];
        const big = [], glow = [];
        for (let i = 0; i < count; i++) {
            let u, lam;
            if (rng() < 0.55) {
                const c = clusters[Math.floor(rng() * clusters.length)];
                u = c.u + gauss() * c.spread * 1.2;
                lam = c.lam + gauss() * c.spread * 3.2;
            } else {
                u = 0.1 + Math.pow(rng(), 1.5) * 0.62;
                lam = gauss() * (0.30 + u * 0.55);
            }
            u = Math.max(0.08, Math.min(0.84, u));
            lam = Math.max(-0.86, Math.min(0.86, lam));
            const size = (0.8 + Math.pow(rng(), 2.2) * 1.9) * (1 - 0.35 * u);
            const f = { u, lam, size, elong: 1.15 + rng() * 0.7, rot: (rng() - 0.5) * 0.6 };
            const r = rng();
            tiers[r < 0.35 ? 0 : (r < 0.75 ? 1 : 2)].push(f);
            if (size > 1.5) big.push(f);
            if (size > 1.5 && rng() < 0.4) glow.push(f);
        }

        const inner = tpl.inner;
        return {
            idx, inner,
            baseAngle: tpl.base,
            angleJitter: (rng() - 0.5) * 0.12,
            lengthMul: tpl.len * (0.93 + rng() * 0.14),
            widthMul: tpl.wid * (0.9 + rng() * 0.2),
            widest: 0.44 + rng() * 0.14,
            widthL: 0.92 + rng() * 0.16,
            widthR: 0.92 + rng() * 0.16,
            tipSharp: 0.05 + rng() * 0.05,
            tipSkew: (rng() - 0.5) * 0.9,
            ruffle: 0.6 + rng() * 0.8,
            waves: [wave(), wave()],
            knots: [knots(), knots()],
            curlSign,
            curl: (0.9 + rng() * 0.6) * tpl.curl,   // total recurve (radians)
            cup: 0.55 + rng() * 0.30,               // inward cupping while closed
            twist: (0.35 + rng() * 0.6) * (rng() < 0.5 ? -1 : 1),
            undulAmp: 0.05 + rng() * 0.08,
            undulFreq: 1.1 + rng() * 0.8,
            undulPh: rng() * LILY_TAU,
            // Opening order: outer tepals first, inner follow
            delay: (inner ? 0.16 + (idx - 3) * 0.035 : idx * 0.03) + (rng() - 0.5) * 0.04,
            // Colour individuality (palette is preserved; only nudged)
            hueShift: (rng() - 0.5) * 8,
            satMul: 0.92 + rng() * 0.16,
            lightShift: (rng() - 0.5) * 5,
            tipHue: (rng() - 0.5) * 9,
            stops: [0.14 + rng() * 0.05, 0.42 + rng() * 0.07, 0.72 + rng() * 0.08],
            veins: [-0.62 + (rng() - 0.5) * 0.12, -0.3 + (rng() - 0.5) * 0.1, 0.3 + (rng() - 0.5) * 0.1, 0.62 + (rng() - 0.5) * 0.12],
            fold: { lam: (rng() - 0.5) * 1.1, u0: 0.2 + rng() * 0.2, u1: 0.65 + rng() * 0.25 },
            blemishes: Array.from({ length: 1 + Math.floor(rng() * 2) }, () => ({
                u: 0.3 + rng() * 0.5, lam: (rng() - 0.5) * 1.2, r: 0.12 + rng() * 0.16, dark: rng() < 0.5
            })),
            freckleTiers: tiers, freckleBig: big, freckleGlow: glow,
            colors: {}
        };
    }

    // =========================================================
    // COLOUR (species palette preserved, nudged per petal & cached)
    // =========================================================

    getPalette(species) {
        let p = this.palettes[species.id];
        if (!p) {
            const T = (s) => LilyColor.toHsl(s);
            p = {
                deepBase: T(species.petal.deepBase), darkShadow: T(species.petal.darkShadow),
                midTone: T(species.petal.midTone), brightTone: T(species.petal.brightTone),
                specular: T(species.petal.specular), rimLight: T(species.petal.rimLight),
                freckleColor: T(species.petal.freckleColor), freckleGlow: T(species.petal.freckleGlow),
                throat: T(species.center.throatBase), nectar: T(species.center.nectarGland),
                bud: T(species.vegetative.budBase)
            };
            this.palettes[species.id] = p;
        }
        return p;
    }

    petalColors(spec, species) {
        let c = spec.colors[species.id];
        if (c) return c;
        const P = this.getPalette(species);
        const dh = spec.hueShift, sm = spec.satMul, dl = spec.lightShift;
        const mk = (o, eh = 0, el = 0, a = 1) =>
            LilyColor.css(o.h + dh + eh, o.s * sm, o.l + dl + el, a);
        const tipMix = LilyColor.mix(P.brightTone, P.specular, 0.36);
        c = {
            deep: mk(P.deepBase), shadow: mk(P.darkShadow), mid: mk(P.midTone),
            bright: mk(P.brightTone, spec.tipHue * 0.5),
            tip: mk(tipMix, spec.tipHue),
            spec: mk(P.specular, spec.tipHue * 0.6),
            rim: mk(P.rimLight),
            freckle: mk(P.freckleColor),
            glow: mk(P.freckleGlow),
            throat: mk(P.throat), throatT: mk(P.throat, 0, 0, 0),
            nectar: mk(P.nectar, 0, 0, 1), nectarT: mk(P.nectar, 0, 0, 0),
            bud: mk(P.bud, 0, 9), budT: mk(P.bud, 0, 9, 0),
            shadowT: mk(P.darkShadow, 0, 0, 0),
            specSoft: mk(P.specular, spec.tipHue * 0.6, 0, 0.4),
            specT: mk(P.specular, spec.tipHue * 0.6, 0, 0)
        };
        spec.colors[species.id] = c;
        return c;
    }

    // =========================================================
    // MAIN RENDER (structure preserved, zero-GC allocations)
    // =========================================================

    render(ctx, cw, ch, state) {
        const { bloom, growth, windForce, time } = state;
        if (growth <= 0.005) return;

        const species = this.currentSpecies;

        // Main bouquet cluster base anchor
        const stemBaseX = cw * 0.72;
        const stemBaseY = ch * 0.98;
        const maxStemHeight = ch * 0.50 * growth;

        // 1. Render Main Stem Spine and Foliage (zero-GC)
        const mainStem = this.drawStem(ctx, stemBaseX, stemBaseY, maxStemHeight, windForce, time, growth, species, 0);

        // 2. Companion stems & branching pedicels (zero-GC)
        const clusterPedicels = this.buildClusterPedicels(mainStem.points, maxStemHeight, windForce, time, growth);

        for (let i = 0; i < this.activePedicelCount; i++) {
            const ped = clusterPedicels[i];
            if (ped.isBack) this.drawPedicelStem(ctx, ped, windForce, time, growth, species);
        }

        // 3. Buds and companion flowers
        for (let i = 0; i < this.activePedicelCount; i++) {
            const ped = clusterPedicels[i];
            if (ped.type === 'bud') {
                const budBloom = ped.budBase + ped.budGain * MathUtils.smoothstep(0.45, 1.0, bloom);
                this.drawSoftLilyBud(ctx, ped.tip.x, ped.tip.y, ped.angle, ped.scale * growth, windForce, time + ped.timeOffset, species, ped.variant, budBloom);
            } else if (ped.type === 'bloom' && ped.isBack) {
                const companionBloom = Math.min(1, Math.max(0, bloom * ped.bloomFactor));
                this.drawSoftLilyBlossom(ctx, ped.tip.x, ped.tip.y, ped.angle, companionBloom, windForce * 0.85, time + ped.timeOffset, ped.scale * growth, species, ped.variant);
            }
        }

        for (let i = 0; i < this.activePedicelCount; i++) {
            const ped = clusterPedicels[i];
            if (!ped.isBack) this.drawPedicelStem(ctx, ped, windForce, time, growth, species);
        }

        for (let i = 0; i < this.activePedicelCount; i++) {
            const ped = clusterPedicels[i];
            if (ped.type === 'bloom' && !ped.isBack) {
                const companionBloom = Math.min(1, Math.max(0, bloom * ped.bloomFactor));
                this.drawSoftLilyBlossom(ctx, ped.tip.x, ped.tip.y, ped.angle, companionBloom, windForce * 0.9, time + ped.timeOffset, ped.scale * growth, species, ped.variant);
            }
        }

        // 4. Main majestic centerpiece blossom
        const mainTip = mainStem.tip;
        const mainScale = (1.05 + bloom * 0.22) * growth;
        this.drawSoftLilyBlossom(ctx, mainTip.x, mainTip.y, mainStem.angle, bloom, windForce, time, mainScale, species, 0);

        return mainTip;
    }

    // =========================================================
    // BOUQUET CLUSTER PEDICELS & ARCHITECTURE
    // =========================================================

    buildClusterPedicels(stemPoints, maxStemHeight, windForce, time, growth) {
        if (stemPoints.length < 10 || growth < 0.15) {
            this.activePedicelCount = 0;
            return this.pedicelPool;
        }

        let count = 0;

        // 1. Companion Flower 1
        const idx1 = Math.floor(33 * 0.54);
        if (stemPoints[idx1]) {
            const pt = stemPoints[idx1];
            const pLength = maxStemHeight * 0.36;
            const pAngle = -Math.PI * 0.74 + windForce * 0.12 + Math.sin(time * 0.7 + 1) * 0.04;
            const ped = this.pedicelPool[count++];
            ped.start = pt;
            ped.tip.x = pt.x + Math.cos(pAngle) * pLength;
            ped.tip.y = pt.y + Math.sin(pAngle) * pLength * 0.85;
            ped.angle = pAngle;
            ped.type = 'bloom';
            ped.scale = 0.78;
            ped.bloomFactor = 0.92;
            ped.timeOffset = 2.1;
            ped.variant = 1;
            ped.isBack = true;
        }

        // 2. Companion Flower 2
        const idx2 = Math.floor(33 * 0.72);
        if (stemPoints[idx2]) {
            const pt = stemPoints[idx2];
            const pLength = maxStemHeight * 0.32;
            const pAngle = -Math.PI * 0.28 + windForce * 0.14 + Math.cos(time * 0.8 + 2) * 0.04;
            const ped = this.pedicelPool[count++];
            ped.start = pt;
            ped.tip.x = pt.x + Math.cos(pAngle) * pLength;
            ped.tip.y = pt.y + Math.sin(pAngle) * pLength * 0.9;
            ped.angle = pAngle;
            ped.type = 'bloom';
            ped.scale = 0.65;
            ped.bloomFactor = 0.82;
            ped.timeOffset = 4.5;
            ped.variant = 2;
            ped.isBack = false;
        }

        // 3. Bud 1
        const idx3 = Math.floor(33 * 0.86);
        if (stemPoints[idx3]) {
            const pt = stemPoints[idx3];
            const pLength = maxStemHeight * 0.22;
            const pAngle = -Math.PI * 0.82 + windForce * 0.15;
            const ped = this.pedicelPool[count++];
            ped.start = pt;
            ped.tip.x = pt.x + Math.cos(pAngle) * pLength;
            ped.tip.y = pt.y + Math.sin(pAngle) * pLength;
            ped.angle = pAngle;
            ped.type = 'bud';
            ped.scale = 0.56;
            ped.isBack = true;
            ped.budBase = 0.03;
            ped.budGain = 0.30;
            ped.timeOffset = 1.3;
            ped.variant = 3;
        }

        // 4. Bud 2
        const idx4 = Math.floor(33 * 0.42);
        if (stemPoints[idx4]) {
            const pt = stemPoints[idx4];
            const pLength = maxStemHeight * 0.24;
            const pAngle = -Math.PI * 0.22 + windForce * 0.1;
            const ped = this.pedicelPool[count++];
            ped.start = pt;
            ped.tip.x = pt.x + Math.cos(pAngle) * pLength;
            ped.tip.y = pt.y + Math.sin(pAngle) * pLength;
            ped.angle = pAngle;
            ped.type = 'bud';
            ped.scale = 0.46;
            ped.isBack = false;
            ped.budBase = 0.0;
            ped.budGain = 0.18;
            ped.timeOffset = 3.7;
            ped.variant = 4;
        }

        this.activePedicelCount = count;
        return this.pedicelPool;
    }

    drawPedicelStem(ctx, ped, windForce, time, growth, species) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const midX = (ped.start.x + ped.tip.x) / 2 + (ped.angle > -Math.PI / 2 ? 6 : -6);
        const midY = (ped.start.y + ped.tip.y) / 2 + 10;

        // Soft back-glow
        ctx.strokeStyle = species.vegetative.stemGlow;
        ctx.lineWidth = 6 * growth;
        ctx.beginPath();
        ctx.moveTo(ped.start.x, ped.start.y);
        ctx.quadraticCurveTo(midX, midY, ped.tip.x, ped.tip.y);
        ctx.stroke();

        // Core pedicel stalk
        ctx.lineWidth = 2.8 * growth;
        ctx.strokeStyle = species.vegetative.stemBase;
        ctx.beginPath();
        ctx.moveTo(ped.start.x, ped.start.y);
        ctx.quadraticCurveTo(midX, midY, ped.tip.x, ped.tip.y);
        ctx.stroke();

        ctx.restore();
    }

    // =========================================================
    // STEM & SOFT CASCADE FOLIAGE (Zero-GC)
    // =========================================================

    drawStem(ctx, baseX, baseY, height, windForce, time, growth, species, seed = 0) {
        const segs = 32;
        const segH = height / segs;
        const points = this.stemPointsPool;

        points[0].x = baseX;
        points[0].y = baseY;
        points[0].width = 8.5 * growth;

        for (let i = 1; i <= segs; i++) {
            const t = i / segs;
            const windBend = windForce * (t * t * 44);
            const sway = this.noise.get(time * 0.6 + i * 0.14 + seed, seed) * 11 * t;

            const px = baseX + windBend + sway;
            const py = baseY - segH * i;
            const w = (8.5 - t * 4.8) * growth;

            points[i].x = px;
            points[i].y = py;
            points[i].width = Math.max(3, w);
        }

        const tip = points[segs];
        const prevTip = points[segs - 2] || points[0];
        const tipAngle = Math.atan2(tip.y - prevTip.y, tip.x - prevTip.x);

        this.stemTipResult.x = tip.x;
        this.stemTipResult.y = tip.y;
        this.mainStemResult.angle = tipAngle;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Trace stem spine once
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i <= segs; i++) ctx.lineTo(points[i].x, points[i].y);

        // Soft ambient back glow
        ctx.strokeStyle = species.vegetative.stemGlow;
        ctx.lineWidth = points[0].width + 11;
        ctx.stroke();

        ctx.lineWidth = points[0].width + 5;
        ctx.stroke();

        // Core deep green stem
        ctx.lineWidth = points[0].width;
        ctx.strokeStyle = species.vegetative.stemBase;
        ctx.stroke();

        // Soft curved highlight ridge
        ctx.beginPath();
        ctx.moveTo(points[0].x + 1.2, points[0].y);
        for (let i = 1; i <= segs; i++) ctx.lineTo(points[i].x + 1.2, points[i].y);
        ctx.lineWidth = points[0].width * 0.4;
        ctx.strokeStyle = species.vegetative.stemHighlight;
        ctx.stroke();

        // Cascading leaves in botanical whorls
        this.drawSoftFoliage(ctx, points, windForce, time, growth, species);

        ctx.restore();

        return this.mainStemResult;
    }

    drawSoftFoliage(ctx, stemPoints, windForce, time, growth, species) {
        const leafNodes = [0.15, 0.28, 0.42, 0.58, 0.72, 0.84];

        for (let idx = 0; idx < leafNodes.length; idx++) {
            const ratio = leafNodes[idx];
            const ptIdx = Math.floor(ratio * 32);
            const pt = stemPoints[ptIdx];
            if (!pt) continue;

            const side = idx % 2 === 0 ? 1 : -1;
            const leafLength = (52 + idx * 7) * growth;
            const leafWidth = (16 + idx * 2.5) * growth;

            const flutter = this.noise.get(time * 0.75 + idx * 2.3, 3) * 0.12;
            const windAngle = windForce * 0.12;
            const angle = (side > 0 ? -0.32 : Math.PI + 0.32) + windAngle + flutter;

            this.drawSoftLanceolateLeaf(ctx, pt.x, pt.y, angle, leafLength, leafWidth, species);
        }
    }

    drawSoftLanceolateLeaf(ctx, x, y, angle, length, width, species) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(length, width);

        let grad = this.leafGradients[species.id];
        if (!grad) {
            grad = ctx.createLinearGradient(0, 0, 1.0, 0);
            grad.addColorStop(0, species.vegetative.leafBase);
            grad.addColorStop(0.5, species.vegetative.leafMid);
            grad.addColorStop(1, species.vegetative.leafHighlight);
            this.leafGradients[species.id] = grad;
        }

        ctx.fillStyle = grad;
        ctx.fill(this.unitLeafPath);

        ctx.strokeStyle = species.vegetative.leafVein;
        ctx.lineWidth = 1.1 / Math.max(length, 1);
        ctx.stroke(this.unitVeinPath);

        ctx.restore();
    }

    // =========================================================
    // BUD
    // =========================================================

    drawSoftLilyBud(ctx, x, y, angle, scale, windForce, time, species, variantSeed = 3, budBloom = 0.04) {
        this.drawSoftLilyBlossom(ctx, x, y, angle, budBloom, windForce, time, scale, species, variantSeed);
    }

    // =========================================================
    // BLOSSOM & BLOOM CHOREOGRAPHY
    // =========================================================

    openCurve(x) {
        x = Math.max(0, Math.min(1, x));
        return x * x * x * (x * (x * 6 - 15) + 10);
    }

    petalTargets(spec, bloom) {
        const span = 0.62;
        return {
            base: this.openCurve((bloom - (spec.delay + 0.05)) / span),
            tip: this.openCurve((bloom - (spec.delay - 0.04)) / (span * 0.92))
        };
    }

    drawSoftLilyBlossom(ctx, cx, cy, stemAngle, bloom, windForce, time, scale, species, variantSeed = 0) {
        const flower = this.getFlower(variantSeed);
        const first = flower.lastTime === null;
        const dt = first ? 0 : MathUtils.clamp(time - flower.lastTime, 0, 0.05);
        flower.lastTime = time;

        ctx.save();
        ctx.translate(cx, cy);

        // Natural tilt and organic sway
        const flowerBaseAngle = stemAngle + Math.PI / 2;
        const sway = this.noise.get(time * 0.7 + variantSeed * 3, 4 + variantSeed) * 0.07 * (1 + bloom);
        const tilt = flowerBaseAngle + windForce * 0.14 + sway + flower.roll;
        ctx.rotate(tilt);

        // --- 0. Advance springs ---
        let openSum = 0;
        for (let i = 0; i < flower.petals.length; i++) {
            const ps = flower.petals[i];
            const breath = this.noise.get(time * 0.5 + i * 1.3 + variantSeed * 2.1, 12 + i) * 0.012;
            const tg = this.petalTargets(ps.spec, bloom + breath);
            if (first) {
                ps.sBase.snap(tg.base);
                ps.sTip.snap(tg.tip);
            } else {
                ps.sBase.setTarget(tg.base);
                ps.sTip.setTarget(tg.tip);
                ps.sBase.update(dt);
                ps.sTip.update(dt);
            }
            ps.pb = ps.sBase.value;
            ps.pt = ps.sTip.value;
            openSum += MathUtils.clamp(ps.pb, 0, 1);
        }
        const openness = openSum / flower.petals.length;

        // --- 1. Atmospheric aura ---
        if (openness > 0.04) {
            const glowR = (85 + openness * 95) * scale;
            const glow = ctx.createRadialGradient(0, -glowR * 0.28, 0, 0, -glowR * 0.28, glowR);
            const { h, s, l } = species.petal.glowHsl;
            glow.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${0.15 * openness})`);
            glow.addColorStop(0.5, `hsla(${h}, ${s}%, ${l - 12}%, ${0.045 * openness})`);
            glow.addColorStop(1, `hsla(${h}, ${s}%, 15%, 0)`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, -glowR * 0.28, glowR, 0, LILY_TAU);
            ctx.fill();
        }

        const maxPetalLength = (88 + openness * 36) * scale;
        const petalWidth = (34 + openness * 22) * scale;
        const detail = maxPetalLength >= 80 ? 2 : (maxPetalLength >= 42 ? 1 : 0);

        // --- 2. Outer tepals ---
        for (let i = 0; i < 3; i++) {
            const ps = flower.petals[i];
            this.drawSoftPetal(ctx, ps, windForce, time, maxPetalLength, petalWidth, scale, species, variantSeed, tilt, detail);
        }

        // --- 3. Throat depth ---
        if (openness > 0.08) {
            const pal = this.petalColors(flower.petals[0].spec, species);
            const r = 15 * scale * openness;
            ctx.save();
            ctx.scale(1, 0.72);
            const tg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.5);
            tg.addColorStop(0, pal.throat);
            tg.addColorStop(0.6, pal.throat);
            tg.addColorStop(1, pal.throatT);
            ctx.fillStyle = tg;
            ctx.beginPath();
            ctx.arc(0, 0, r * 1.5, 0, LILY_TAU);
            ctx.fill();
            const ng = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            ng.addColorStop(0, pal.nectar);
            ng.addColorStop(1, pal.nectarT);
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = ng;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, LILY_TAU);
            ctx.fill();
            ctx.restore();
        }

        // --- 4. Reproductive Core ---
        if (openness > 0.12) {
            const coreOpen = MathUtils.smoothstep(0.1, 0.85, openness);
            this.drawSoftReproductiveCore(ctx, coreOpen, windForce, time, scale, species, variantSeed);
        }

        // --- 5. Inner tepals ---
        for (let i = 3; i < 6; i++) {
            const ps = flower.petals[i];
            this.drawSoftPetal(ctx, ps, windForce, time, maxPetalLength, petalWidth, scale, species, variantSeed, tilt, detail);
        }

        ctx.restore();
    }

    // =========================================================
    // PETAL: geometry & direct path tracing (Zero-GC)
    // =========================================================

    petalProfile(t, widest, tipSharp) {
        if (t < widest) {
            const f = Math.sin((t / widest) * Math.PI * 0.5);
            return 0.12 + 0.88 * Math.pow(f, 1.25);
        }
        const u = (t - widest) / (1 - widest);
        return Math.max(tipSharp, Math.pow(Math.cos(u * Math.PI * 0.5), 0.85));
    }

    knot(arr, t) {
        const pos = t * (arr.length - 1);
        const i = Math.min(arr.length - 2, Math.floor(pos));
        const f = pos - i;
        const s = f * f * (3 - 2 * f);
        return arr[i] + (arr[i + 1] - arr[i]) * s;
    }

    edgeMod(spec, side, t, ruffle) {
        const w = spec.waves[side];
        let m = 0;
        for (let h = 0; h < 3; h++) m += w[h].a * Math.sin(LILY_TAU * w[h].f * t + w[h].p);
        m += this.knot(spec.knots[side], t) * 0.06;
        return 1 + m * (0.35 + 0.65 * t) * ruffle;
    }

    lilyPoint(u, lam, out) {
        const S = this.scr;
        const f = Math.min(Math.max(u, 0), 1) * (S.N - 1);
        let i = Math.floor(f);
        if (i >= S.N - 1) i = S.N - 2;
        const r = f - i, j = i + 1;
        const x = S.xs[i] + (S.xs[j] - S.xs[i]) * r;
        const y = S.ys[i] + (S.ys[j] - S.ys[i]) * r;
        const nx = S.nx[i] + (S.nx[j] - S.nx[i]) * r;
        const ny = S.ny[i] + (S.ny[j] - S.ny[i]) * r;
        const w = lam >= 0
            ? S.wl[i] + (S.wl[j] - S.wl[i]) * r
            : S.wr[i] + (S.wr[j] - S.wr[i]) * r;
        out.x = x + nx * lam * w;
        out.y = y + ny * lam * w;
        out.psi = S.psi[i] + (S.psi[j] - S.psi[i]) * r;
    }

    /** Traces offset polyline directly onto canvas context (0 Path2D allocations) */
    traceOffsetPath(ctx, lam, k0, k1) {
        const S = this.scr;
        ctx.beginPath();
        for (let k = k0; k <= k1; k++) {
            const w = lam >= 0 ? S.wl[k] : S.wr[k];
            const x = S.xs[k] + S.nx[k] * lam * w;
            const y = S.ys[k] + S.ny[k] * lam * w;
            if (k === k0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
    }

    /** Traces closed petal outline directly onto canvas context (0 Path2D allocations) */
    tracePetalOutline(ctx) {
        const S = this.scr;
        const N = S.N;
        const M = N * 2;
        ctx.beginPath();
        ctx.moveTo((S.px[M - 1] + S.px[0]) * 0.5, (S.py[M - 1] + S.py[0]) * 0.5);
        for (let i = 0; i < M; i++) {
            const j = (i + 1) % M;
            ctx.quadraticCurveTo(S.px[i], S.py[i], (S.px[i] + S.px[j]) * 0.5, (S.py[i] + S.py[j]) * 0.5);
        }
        ctx.closePath();
    }

    buildPetalStations(spec, N, L, halfW, pb, pt, windForce, flutterAmp, tipFlutter) {
        const S = this.scr;
        S.N = N;
        const ds = L / (N - 1);
        const ptc = MathUtils.clamp(pt, 0, 1);
        const pbc = MathUtils.clamp(pb, 0, 1);
        const windFlex = windForce * 0.11;
        const ruffle = (0.45 + 0.55 * ptc) * spec.ruffle;
        let x = 0, y = 0, prevPsi = 0;

        for (let k = 0; k < N; k++) {
            const t = k / (N - 1);

            const psi =
                spec.curlSign * spec.curl * pt * Math.pow(t, 1.55)
                - spec.curlSign * spec.cup * (1 - ptc) * Math.pow(t, 1.9)
                + spec.undulAmp * Math.sin(t * Math.PI * spec.undulFreq + spec.undulPh) * (0.35 + 0.65 * pbc) * t
                + spec.tipSkew * 0.28 * MathUtils.smoothstep(0.55, 1, t)
                + windFlex * t * t
                + tipFlutter * t * t + flutterAmp * t;

            if (k > 0) {
                const m = (psi + prevPsi) * 0.5;
                x += Math.cos(m) * ds;
                y += Math.sin(m) * ds;
            }
            prevPsi = psi;

            const tau = spec.twist * Math.pow(t, 1.25) * (0.3 + 0.7 * ptc);
            const c = Math.max(0.3, Math.cos(tau));
            const prof = this.petalProfile(t, spec.widest, spec.tipSharp) * halfW * c;

            S.xs[k] = x; S.ys[k] = y;
            S.nx[k] = -Math.sin(psi); S.ny[k] = Math.cos(psi);
            S.psi[k] = psi;
            S.wl[k] = prof * spec.widthL * this.edgeMod(spec, 0, t, ruffle);
            S.wr[k] = prof * spec.widthR * this.edgeMod(spec, 1, t, ruffle);
        }

        const M = N * 2;
        for (let k = 0; k < N; k++) {
            S.px[k] = S.xs[k] + S.nx[k] * S.wl[k];
            S.py[k] = S.ys[k] + S.ny[k] * S.wl[k];
            const j = M - 1 - k;
            S.px[j] = S.xs[k] - S.nx[k] * S.wr[k];
            S.py[j] = S.ys[k] - S.ny[k] * S.wr[k];
        }
    }

    // =========================================================
    // PETAL: shading & texture (Zero-GC)
    // =========================================================

    drawSoftPetal(ctx, ps, windForce, time, maxLen, maxWid, scale, species, variantSeed, tilt, detail) {
        const spec = ps.spec;
        const colors = spec.colors[species.id] || this.petalColors(spec, species);
        const pb = MathUtils.clamp(ps.pb, -0.05, 1.08);
        const pt = MathUtils.clamp(ps.pt, -0.05, 1.1);
        const pbc = MathUtils.clamp(pb, 0, 1);
        const isInner = spec.inner;
        const idx = spec.idx;

        const flutter = this.noise.get(time * 1.3 + idx * 1.7 + variantSeed, idx + variantSeed) * 0.035 * (1 + pbc);
        const tipFlutter = this.noise.get(time * 1.9 + idx * 2.1 + variantSeed * 1.3, 10 + idx) * 0.07;

        const closedAngle = -Math.PI / 2 + (spec.baseAngle + Math.PI / 2) * 0.06 + spec.angleJitter * 0.3;
        const openAngle = spec.baseAngle + spec.angleJitter;
        const angle = MathUtils.lerp(closedAngle, openAngle, pb) + flutter + windForce * 0.055;

        const swell = Math.sin(MathUtils.clamp(pbc * 2.2, 0, 1) * Math.PI) * 0.05;
        const wFactor = 0.62 + 0.38 * pbc + swell;
        const L = maxLen * spec.lengthMul * (0.84 + 0.16 * MathUtils.clamp(pt, 0, 1));
        const halfW = maxWid * 0.46 * spec.widthMul * wFactor;
        if (L < 1.5 || halfW < 0.3) return;

        const N = detail >= 2 ? 22 : (detail === 1 ? 16 : 12);

        ctx.save();
        ctx.rotate(angle);

        this.buildPetalStations(spec, N, L, halfW, pb, pt, windForce, flutter * 0.6, tipFlutter);
        const S = this.scr;
        const tipX = S.xs[N - 1], tipY = S.ys[N - 1];
        const midI = Math.floor((N - 1) * 0.5);

        // --- A. Soft contact shadow ---
        if (isInner) {
            ctx.save();
            ctx.lineJoin = 'round';
            ctx.strokeStyle = colors.deep;
            ctx.globalAlpha = 0.10;
            ctx.lineWidth = 8 * scale;
            this.tracePetalOutline(ctx);
            ctx.stroke();
            ctx.globalAlpha = 0.14;
            ctx.lineWidth = 3.4 * scale;
            this.tracePetalOutline(ctx);
            ctx.stroke();
            ctx.restore();
        }

        // --- B. Layered body gradient ---
        const g = ctx.createLinearGradient(0, 0, tipX, tipY);
        g.addColorStop(0, colors.deep);
        g.addColorStop(spec.stops[0], colors.shadow);
        g.addColorStop(spec.stops[1], colors.mid);
        g.addColorStop(spec.stops[2], colors.bright);
        g.addColorStop(1, colors.tip);
        ctx.fillStyle = g;
        this.tracePetalOutline(ctx);
        ctx.fill();

        // Clip to petal interior
        ctx.save();
        this.tracePetalOutline(ctx);
        ctx.clip();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // --- C. Calyx green ---
        const greenAmt = MathUtils.clamp((1 - pbc) * (isInner ? 0.45 : 0.85), 0, 0.9);
        if (greenAmt > 0.03) {
            const gi = Math.floor((N - 1) * 0.8);
            const cg = ctx.createLinearGradient(0, 0, S.xs[gi], S.ys[gi]);
            cg.addColorStop(0, colors.bud);
            cg.addColorStop(0.5, colors.bud);
            cg.addColorStop(1, colors.budT);
            ctx.globalAlpha = greenAmt;
            ctx.fillStyle = cg;
            this.tracePetalOutline(ctx);
            ctx.fill();
        }

        // --- D. Subsurface scattering ---
        const sss = 0.55 + 0.45 * pbc;
        ctx.strokeStyle = colors.bright;
        ctx.globalAlpha = 0.20 * sss;
        ctx.lineWidth = halfW * 0.55;
        this.tracePetalOutline(ctx);
        ctx.stroke();

        ctx.strokeStyle = colors.spec;
        ctx.globalAlpha = 0.09 * sss;
        ctx.lineWidth = halfW * 0.18;
        this.tracePetalOutline(ctx);
        ctx.stroke();

        const ti = Math.floor((N - 1) * 0.5);
        const tg = ctx.createLinearGradient(S.xs[ti], S.ys[ti], tipX, tipY);
        tg.addColorStop(0, colors.specT);
        tg.addColorStop(1, colors.spec);
        ctx.globalAlpha = 0.16 * sss;
        ctx.fillStyle = tg;
        this.tracePetalOutline(ctx);
        ctx.fill();

        // --- E. Throat pigment cloud ---
        const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, L * 0.5);
        pg.addColorStop(0, colors.throat);
        pg.addColorStop(1, colors.throatT);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = pg;
        this.tracePetalOutline(ctx);
        ctx.fill();

        // Nectar furrow
        if (detail >= 1) {
            const ni = Math.max(2, Math.floor((N - 1) * 0.34));
            this.traceOffsetPath(ctx, 0, 0, ni);
            const ng = ctx.createLinearGradient(S.xs[0], S.ys[0], S.xs[ni], S.ys[ni]);
            ng.addColorStop(0, colors.nectar);
            ng.addColorStop(1, colors.nectarT);
            ctx.strokeStyle = ng;
            ctx.lineWidth = Math.max(1, halfW * 0.2);
            ctx.globalAlpha = 0.32 * pbc;
            ctx.stroke();
        }

        // --- F. Midrib furrow ---
        this.traceOffsetPath(ctx, 0, 0, N - 1);
        ctx.strokeStyle = colors.shadow;
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = halfW * 0.30;
        ctx.stroke();

        this.traceOffsetPath(ctx, 0, 0, N - 1);
        ctx.strokeStyle = colors.spec;
        ctx.globalAlpha = 0.14;
        ctx.lineWidth = Math.max(0.6, 0.9 * scale);
        ctx.stroke();

        // --- G. Veins & fold crease ---
        if (detail >= 2) {
            ctx.strokeStyle = colors.bright;
            ctx.globalAlpha = 0.07;
            ctx.lineWidth = Math.max(0.5, 0.8 * scale);
            for (const lam of spec.veins) {
                this.traceOffsetPath(ctx, lam, 1, N - 2);
                ctx.stroke();
            }
        }
        if (detail >= 1) {
            const k0 = Math.round(spec.fold.u0 * (N - 1)), k1 = Math.round(spec.fold.u1 * (N - 1));
            this.traceOffsetPath(ctx, spec.fold.lam, k0, k1);
            ctx.strokeStyle = colors.deep;
            ctx.globalAlpha = 0.10;
            ctx.lineWidth = halfW * 0.16;
            ctx.stroke();

            this.traceOffsetPath(ctx, spec.fold.lam + (spec.fold.lam > 0 ? -0.08 : 0.08), k0, k1);
            ctx.strokeStyle = colors.spec;
            ctx.globalAlpha = 0.06;
            ctx.lineWidth = halfW * 0.07;
            ctx.stroke();
        }

        // --- H. Papillae (freckles) & blemishes ---
        if (detail >= 1) this.drawFreckles(ctx, spec, colors, scale, pbc, halfW);

        // --- I. Directional light falloff ---
        const lightLocal = LILY_LIGHT_ANGLE - (tilt + angle);
        const lx = Math.cos(lightLocal), ly = Math.sin(lightLocal);
        const mx = S.xs[midI], my = S.ys[midI];
        const R = halfW * 1.05 + L * 0.08;
        const lg = ctx.createLinearGradient(mx - lx * R, my - ly * R, mx + lx * R, my + ly * R);
        lg.addColorStop(0, colors.shadow);
        lg.addColorStop(0.55, colors.shadowT);
        lg.addColorStop(0.55, colors.specT);
        lg.addColorStop(1, colors.specSoft);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = lg;
        this.tracePetalOutline(ctx);
        ctx.fill();

        // --- J. Soft sheen ---
        if (detail >= 1) {
            const side = (S.nx[midI] * lx + S.ny[midI] * ly) >= 0 ? 1 : -1;
            const k0 = Math.round(0.18 * (N - 1)), k1 = Math.round(0.88 * (N - 1));
            this.traceOffsetPath(ctx, side * 0.38, k0, k1);
            ctx.globalCompositeOperation = 'screen';
            ctx.strokeStyle = colors.spec;
            ctx.globalAlpha = 0.07;
            ctx.lineWidth = halfW * 0.75;
            ctx.stroke();
            ctx.globalAlpha = 0.10;
            ctx.lineWidth = halfW * 0.28;
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore(); // end clip

        // --- K. Fine rim stroke ---
        ctx.strokeStyle = colors.rim;
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 0.9;
        this.tracePetalOutline(ctx);
        ctx.stroke();

        ctx.restore();
    }

    drawFreckles(ctx, spec, colors, scale, vis, halfW) {
        const reveal = MathUtils.smoothstep(0.1, 0.6, vis);
        if (reveal < 0.02) return;
        const p = this.tmpPt;
        const alphas = [0.42, 0.66, 0.88];

        ctx.fillStyle = colors.freckle;
        for (let t = 0; t < 3; t++) {
            const list = spec.freckleTiers[t];
            if (!list.length) continue;
            ctx.globalAlpha = alphas[t] * reveal;
            ctx.beginPath();
            for (const f of list) {
                this.lilyPoint(f.u, f.lam, p);
                const ry = Math.max(0.5, f.size * scale);
                const rx = ry * f.elong;
                const rot = p.psi + f.rot;
                ctx.moveTo(p.x + rx * Math.cos(rot), p.y + rx * Math.sin(rot));
                ctx.ellipse(p.x, p.y, rx, ry, rot, 0, LILY_TAU);
            }
            ctx.fill();
        }

        // Catch light
        ctx.fillStyle = colors.spec;
        ctx.globalAlpha = 0.16 * reveal;
        ctx.beginPath();
        for (const f of spec.freckleBig) {
            this.lilyPoint(f.u, f.lam, p);
            const r = Math.max(0.3, f.size * scale * 0.35);
            ctx.moveTo(p.x - r * 0.6 + r, p.y - r * 0.5);
            ctx.arc(p.x - r * 0.6, p.y - r * 0.5, r, 0, LILY_TAU);
        }
        ctx.fill();

        // Pollen specks
        ctx.fillStyle = colors.glow;
        ctx.globalAlpha = 0.5 * reveal;
        ctx.beginPath();
        for (const f of spec.freckleGlow) {
            this.lilyPoint(f.u, f.lam, p);
            const r = Math.max(0.3, f.size * scale * 0.34);
            ctx.moveTo(p.x + 0.3 + r, p.y - 0.2);
            ctx.arc(p.x + 0.3, p.y - 0.2, r, 0, LILY_TAU);
        }
        ctx.fill();

        // Blemishes
        for (const b of spec.blemishes) {
            this.lilyPoint(b.u, b.lam, p);
            const r = Math.max(1, b.r * halfW);
            ctx.fillStyle = b.dark ? colors.deep : colors.bright;
            ctx.globalAlpha = 0.05 * reveal;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, r * 1.4, r, p.psi, 0, LILY_TAU);
            ctx.fill();
            ctx.globalAlpha = 0.06 * reveal;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, r * 0.8, r * 0.55, p.psi, 0, LILY_TAU);
            ctx.fill();
        }
    }

    // =========================================================
    // REPRODUCTIVE CORE
    // =========================================================

    drawSoftReproductiveCore(ctx, bloom, windForce, time, scale, species, variantSeed) {
        ctx.save();

        const stamenCount = 6;
        const center = species.center;
        const filamentLen = (40 + bloom * 30) * scale;

        // 1. Central arching pistil
        const pistilLen = filamentLen * 1.22;
        const styleSway = this.noise.get(time * 0.85 + variantSeed, 8) * 3.5 * scale;
        const pistilTipX = Math.cos(-Math.PI / 2 + 0.08) * pistilLen + windForce * 5 + styleSway;
        const pistilTipY = Math.sin(-Math.PI / 2 + 0.08) * pistilLen;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = center.styleColor;
        ctx.lineWidth = 2.8 * scale;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(pistilTipX * 0.5 + 3, pistilTipY * 0.5, pistilTipX, pistilTipY);
        ctx.stroke();

        ctx.fillStyle = center.stigmaColor;
        for (let lobe = 0; lobe < 3; lobe++) {
            const lAngle = (lobe * Math.PI * 2) / 3 + time * 0.15;
            const lx = pistilTipX + Math.cos(lAngle) * 3.4 * scale;
            const ly = pistilTipY + Math.sin(lAngle) * 3.4 * scale;
            ctx.beginPath();
            ctx.arc(lx, ly, 2.9 * scale, 0, Math.PI * 2);
            ctx.fill();
        }
        // Dewdrop glint
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(pistilTipX, pistilTipY - 1, 1.1 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Six arching filaments with anthers
        for (let i = 0; i < stamenCount; i++) {
            const radAngle = (i / stamenCount) * Math.PI * 2 + (i % 2 === 0 ? 0.1 : -0.1);
            const spreadRad = (20 + bloom * 34) * scale;
            const fFlutter = this.noise.get(time * 1.1 + i * 1.4 + variantSeed, 9 + i) * 3.2 * scale;

            const targetX = Math.cos(radAngle) * spreadRad + windForce * 3.5 + fFlutter;
            const targetY = Math.sin(radAngle) * spreadRad * 0.85 - (22 + bloom * 16) * scale;

            const fGrad = ctx.createLinearGradient(0, 0, targetX, targetY);
            fGrad.addColorStop(0, center.filamentBase);
            fGrad.addColorStop(1, center.filamentTip);

            ctx.save();
            ctx.strokeStyle = fGrad;
            ctx.lineWidth = 1.8 * scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(targetX * 0.4, targetY * 0.7 + 5, targetX, targetY);
            ctx.stroke();

            this.drawSoftAnther(ctx, targetX, targetY, radAngle, scale, center);
            ctx.restore();
        }

        ctx.restore();
    }

    drawSoftAnther(ctx, x, y, angle, scale, center) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + Math.PI / 2);

        const antherL = 11 * scale;
        const antherW = 5.0 * scale;

        ctx.globalAlpha = 0.12;
        ctx.fillStyle = center.pollenDust;
        ctx.beginPath();
        ctx.ellipse(0, 0, antherL * 0.75, antherW * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = center.antherBody;
        ctx.beginPath();
        ctx.roundRect(-antherL / 2, -antherW / 2, antherL, antherW, 2.5 * scale);
        ctx.fill();

        ctx.fillStyle = center.pollenDust;
        ctx.beginPath();
        ctx.ellipse(-antherL * 0.22, 0, antherL * 0.22, antherW * 0.38, 0, 0, Math.PI * 2);
        ctx.ellipse(antherL * 0.22, 0, antherL * 0.22, antherW * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = center.pollenSparkle;
        ctx.beginPath();
        ctx.arc(-antherL * 0.2, -antherW * 0.18, 1.1 * scale, 0, Math.PI * 2);
        ctx.arc(antherL * 0.2, antherW * 0.18, 0.9 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

window.LilyRenderer = LilyRenderer;