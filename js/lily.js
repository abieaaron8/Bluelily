/* =============================================================
   BOTANICAL LILY BOUQUET RENDERER
   Renders a living bouquet / mini garden of rare Lilium:
   - Multiple blooms at varied growth stages, angles, and sizes
   - Soft rounded petal contours with gentle undulating folds
   - Velvety translucency, soft specular sheen, organic asymmetry
   - Natural stamens with velvety pollen anthers and 3-lobed pistil
   - Harmonic wind sway with organic delayed phase offsets
   ============================================================= */

class LilyRenderer {
    constructor() {
        this.noise = new OrganicNoise();
        this.speciesKey = 'blue';
        this.currentSpecies = LILY_SPECIES.blue;

        // Precomputed organic freckle coordinates with soft watercolor dispersion
        this.frecklePatterns = Array.from({ length: 12 }, (_, pIdx) => {
            const count = 14;
            return Array.from({ length: count }, (_, i) => {
                const u = 0.15 + (i / count) * 0.42;
                const vSpread = Math.sin(u * Math.PI) * 0.32;
                const v = ((i % 3 - 1) * 0.55 + Math.sin(pIdx * 5 + i * 2.7) * 0.35) * vSpread;
                const size = 1.2 + ((i * 3) % 4) * 0.4;
                return { u, v, size };
            });
        });
    }

    setSpecies(key) {
        if (LILY_SPECIES[key]) {
            this.speciesKey = key;
            this.currentSpecies = LILY_SPECIES[key];
        }
    }

    /**
     * Renders the living bouquet / mini garden of lilies
     */
    render(ctx, cw, ch, state) {
        const { bloom, growth, windForce, time } = state;
        if (growth <= 0.005) return;

        const species = this.currentSpecies;

        // Main bouquet cluster base anchor (bottom-right natural botanical placement)
        const stemBaseX = cw * 0.72;
        const stemBaseY = ch * 0.98;
        const maxStemHeight = ch * 0.50 * growth;

        // 1. Render Main Stem Spine and Foliage
        const mainStem = this.drawStem(ctx, stemBaseX, stemBaseY, maxStemHeight, windForce, time, growth, species, 0);

        // 2. Render Secondary Companion Stems & Branching Pedicels (BOUQUET CLUSTER)
        const clusterPedicels = this.buildClusterPedicels(mainStem.points, maxStemHeight, windForce, time, growth);

        // Draw background pedicels first (depth sorting)
        for (const ped of clusterPedicels) {
            if (ped.isBack) {
                this.drawPedicelStem(ctx, ped, windForce, time, growth, species);
            }
        }

        // 3. Render Buds and Companion Flowers in the Bouquet
        for (const ped of clusterPedicels) {
            if (ped.type === 'bud') {
                this.drawSoftLilyBud(ctx, ped.tip.x, ped.tip.y, ped.angle, ped.scale * growth, windForce, time, species);
            } else if (ped.type === 'bloom' && ped.isBack) {
                const companionBloom = Math.min(1, Math.max(0, bloom * ped.bloomFactor));
                this.drawSoftLilyBlossom(ctx, ped.tip.x, ped.tip.y, ped.angle, companionBloom, windForce * 0.85, time + ped.timeOffset, ped.scale * growth, species, ped.variant);
            }
        }

        // Draw foreground pedicels
        for (const ped of clusterPedicels) {
            if (!ped.isBack) {
                this.drawPedicelStem(ctx, ped, windForce, time, growth, species);
            }
        }

        // Foreground companion blooms
        for (const ped of clusterPedicels) {
            if (ped.type === 'bloom' && !ped.isBack) {
                const companionBloom = Math.min(1, Math.max(0, bloom * ped.bloomFactor));
                this.drawSoftLilyBlossom(ctx, ped.tip.x, ped.tip.y, ped.angle, companionBloom, windForce * 0.9, time + ped.timeOffset, ped.scale * growth, species, ped.variant);
            }
        }

        // 4. Main Majestic Centerpiece Blossom (The Queen of the Bouquet)
        const mainTip = mainStem.tip;
        const mainScale = (1.05 + bloom * 0.22) * growth;
        this.drawSoftLilyBlossom(ctx, mainTip.x, mainTip.y, mainStem.angle, bloom, windForce, time, mainScale, species, 0);

        // Return main blossom tip for golden pollen particle emitter
        return mainTip;
    }

    // =========================================================
    // BOUQUET CLUSTER PEDICELS & ARCHITECTURE
    // =========================================================

    buildClusterPedicels(stemPoints, maxStemHeight, windForce, time, growth) {
        if (stemPoints.length < 10 || growth < 0.15) return [];

        const pedicels = [];

        // 1. Companion Flower 1: Left lower-mid flank (Mature open bloom)
        const idx1 = Math.floor(stemPoints.length * 0.54);
        if (stemPoints[idx1]) {
            const pt = stemPoints[idx1];
            const pLength = maxStemHeight * 0.36;
            const pAngle = -Math.PI * 0.74 + windForce * 0.12 + Math.sin(time * 0.7 + 1) * 0.04;
            const tipX = pt.x + Math.cos(pAngle) * pLength;
            const tipY = pt.y + Math.sin(pAngle) * pLength * 0.85;
            pedicels.push({
                start: pt,
                tip: { x: tipX, y: tipY },
                angle: pAngle,
                type: 'bloom',
                scale: 0.78,
                bloomFactor: 0.92,
                timeOffset: 2.1,
                variant: 1,
                isBack: true
            });
        }

        // 2. Companion Flower 2: Right upper flank (Young half-opened bloom)
        const idx2 = Math.floor(stemPoints.length * 0.72);
        if (stemPoints[idx2]) {
            const pt = stemPoints[idx2];
            const pLength = maxStemHeight * 0.32;
            const pAngle = -Math.PI * 0.28 + windForce * 0.14 + Math.cos(time * 0.8 + 2) * 0.04;
            const tipX = pt.x + Math.cos(pAngle) * pLength;
            const tipY = pt.y + Math.sin(pAngle) * pLength * 0.9;
            pedicels.push({
                start: pt,
                tip: { x: tipX, y: tipY },
                angle: pAngle,
                type: 'bloom',
                scale: 0.65,
                bloomFactor: 0.82,
                timeOffset: 4.5,
                variant: 2,
                isBack: false
            });
        }

        // 3. Bud 1: High left arching bud (Sleek elongated lily bud)
        const idx3 = Math.floor(stemPoints.length * 0.86);
        if (stemPoints[idx3]) {
            const pt = stemPoints[idx3];
            const pLength = maxStemHeight * 0.22;
            const pAngle = -Math.PI * 0.82 + windForce * 0.15;
            const tipX = pt.x + Math.cos(pAngle) * pLength;
            const tipY = pt.y + Math.sin(pAngle) * pLength;
            pedicels.push({
                start: pt,
                tip: { x: tipX, y: tipY },
                angle: pAngle,
                type: 'bud',
                scale: 0.48,
                isBack: true
            });
        }

        // 4. Bud 2: Lower right accent bud
        const idx4 = Math.floor(stemPoints.length * 0.42);
        if (stemPoints[idx4]) {
            const pt = stemPoints[idx4];
            const pLength = maxStemHeight * 0.24;
            const pAngle = -Math.PI * 0.22 + windForce * 0.1;
            const tipX = pt.x + Math.cos(pAngle) * pLength;
            const tipY = pt.y + Math.sin(pAngle) * pLength;
            pedicels.push({
                start: pt,
                tip: { x: tipX, y: tipY },
                angle: pAngle,
                type: 'bud',
                scale: 0.38,
                isBack: false
            });
        }

        return pedicels;
    }

    drawPedicelStem(ctx, ped, windForce, time, growth, species) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const midX = (ped.start.x + ped.tip.x) / 2 + (ped.angle > -Math.PI / 2 ? 6 : -6);
        const midY = (ped.start.y + ped.tip.y) / 2 + 10;

        // Soft back-glow
        ctx.lineWidth = 5 * growth;
        ctx.strokeStyle = species.vegetative.stemGlow;
        ctx.shadowBlur = 8;
        ctx.shadowColor = species.vegetative.stemGlow;
        ctx.beginPath();
        ctx.moveTo(ped.start.x, ped.start.y);
        ctx.quadraticCurveTo(midX, midY, ped.tip.x, ped.tip.y);
        ctx.stroke();

        // Core pedicel stalk
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2.8 * growth;
        ctx.strokeStyle = species.vegetative.stemBase;
        ctx.beginPath();
        ctx.moveTo(ped.start.x, ped.start.y);
        ctx.quadraticCurveTo(midX, midY, ped.tip.x, ped.tip.y);
        ctx.stroke();

        ctx.restore();
    }

    // =========================================================
    // STEM & SOFT CASCADE FOLIAGE
    // =========================================================

    drawStem(ctx, baseX, baseY, height, windForce, time, growth, species, seed = 0) {
        const segs = 32;
        const segH = height / segs;
        const points = [{ x: baseX, y: baseY, width: 8.5 * growth }];

        for (let i = 1; i <= segs; i++) {
            const t = i / segs;
            const windBend = windForce * (t * t * 44);
            const sway = this.noise.get(time * 0.6 + i * 0.14 + seed, seed) * 11 * t;

            const px = baseX + windBend + sway;
            const py = baseY - segH * i;
            const w = (8.5 - t * 4.8) * growth;

            points.push({ x: px, y: py, width: Math.max(3, w) });
        }

        const tip = points[points.length - 1];
        const prevTip = points[points.length - 3] || points[0];
        const tipAngle = Math.atan2(tip.y - prevTip.y, tip.x - prevTip.x);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Soft ambient back glow for organic presence
        ctx.lineWidth = points[0].width + 7;
        ctx.strokeStyle = species.vegetative.stemGlow;
        ctx.shadowBlur = 14;
        ctx.shadowColor = species.vegetative.stemGlow;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();

        // Core deep botanical green stem
        ctx.shadowBlur = 0;
        ctx.lineWidth = points[0].width;
        ctx.strokeStyle = species.vegetative.stemBase;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();

        // Soft curved highlight ridge
        ctx.lineWidth = points[0].width * 0.4;
        ctx.strokeStyle = species.vegetative.stemHighlight;
        ctx.beginPath();
        ctx.moveTo(points[0].x + 1.2, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x + 1.2, points[i].y);
        ctx.stroke();

        // Cascading leaves in botanical whorls
        this.drawSoftFoliage(ctx, points, windForce, time, growth, species);

        ctx.restore();

        return { tip, points, angle: tipAngle };
    }

    drawSoftFoliage(ctx, stemPoints, windForce, time, growth, species) {
        // Natural distribution along the stem
        const leafNodes = [0.15, 0.28, 0.42, 0.58, 0.72, 0.84];

        for (let idx = 0; idx < leafNodes.length; idx++) {
            const ratio = leafNodes[idx];
            const ptIdx = Math.floor(ratio * (stemPoints.length - 1));
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

    /**
     * Soft, organic curved lanceolate leaf with rounded tip and translucent veins
     */
    drawSoftLanceolateLeaf(ctx, x, y, angle, length, width, species) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Smooth sweeping curve with gentle recurve at tip
        const ctrlX1 = length * 0.35;
        const ctrlY1 = -width * 0.65;
        const ctrlX2 = length * 0.72;
        const ctrlY2 = -width * 0.35;
        const tipX = length;
        const tipY = width * 0.2;

        const grad = ctx.createLinearGradient(0, 0, length, 0);
        grad.addColorStop(0, species.vegetative.leafBase);
        grad.addColorStop(0.5, species.vegetative.leafMid);
        grad.addColorStop(1, species.vegetative.leafHighlight);

        ctx.fillStyle = grad;
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';

        ctx.beginPath();
        ctx.moveTo(0, 0);
        // Soft undulating upper margin
        ctx.bezierCurveTo(ctrlX1, ctrlY1, ctrlX2, ctrlY2, tipX, tipY);
        // Soft rounded tip arc instead of sharp spike
        ctx.bezierCurveTo(tipX + 3, tipY + width * 0.15, tipX - 2, tipY + width * 0.3, tipX - 6, tipY + width * 0.35);
        // Soft lower margin returning to stem base
        ctx.bezierCurveTo(ctrlX2 * 0.9, ctrlY2 + width * 0.8, ctrlX1 * 0.8, ctrlY1 + width * 0.95, 0, 0);
        ctx.closePath();
        ctx.fill();

        // Delicate translucent center vein
        ctx.strokeStyle = species.vegetative.leafVein;
        ctx.lineWidth = 1.1;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(3, 0);
        ctx.quadraticCurveTo(length * 0.5, -width * 0.12, tipX * 0.9, tipY * 0.85);
        ctx.stroke();

        ctx.restore();
    }

    // =========================================================
    // SOFT BOTANICAL LILY BUDS
    // =========================================================

    drawSoftLilyBud(ctx, x, y, angle, scale, windForce, time, species) {
        ctx.save();
        ctx.translate(x, y);
        const flutter = this.noise.get(time * 0.8, 5) * 0.05;
        ctx.rotate(angle + windForce * 0.1 + flutter);

        const budSize = 38 * scale;
        const budW = budSize * 0.30;

        // Soft gradient from leafy green calyx to tinted petal tip
        const grad = ctx.createLinearGradient(0, 0, budSize, 0);
        grad.addColorStop(0, species.vegetative.budBase);
        grad.addColorStop(0.45, species.vegetative.budBase);
        grad.addColorStop(0.75, species.vegetative.budTip);
        grad.addColorStop(1, species.petal.brightTone);

        ctx.fillStyle = grad;
        ctx.shadowBlur = 8 * scale;
        ctx.shadowColor = species.petal.darkShadow;

        // Rounded, gently curved bud capsule
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(budSize * 0.28, -budW, budSize * 0.68, -budW * 0.75, budSize, 0);
        ctx.bezierCurveTo(budSize * 0.68, budW * 0.75, budSize * 0.28, budW, 0, 0);
        ctx.closePath();
        ctx.fill();

        // Soft seam where petals will gently open
        ctx.strokeStyle = species.petal.darkShadow;
        ctx.lineWidth = 0.9 * scale;
        ctx.beginPath();
        ctx.moveTo(budSize * 0.15, 0);
        ctx.lineTo(budSize * 0.92, 0);
        ctx.stroke();

        ctx.restore();
    }

    // =========================================================
    // SOFT BOTANICAL LILY BLOSSOM (SOFTER, MORE NATURAL)
    // =========================================================

    drawSoftLilyBlossom(ctx, cx, cy, stemAngle, bloom, windForce, time, scale, species, variantSeed = 0) {
        ctx.save();
        ctx.translate(cx, cy);

        // Natural tilt and dynamic organic sway
        const flowerBaseAngle = stemAngle + Math.PI / 2;
        const sway = this.noise.get(time * 0.7 + variantSeed * 3, 4 + variantSeed) * 0.07 * (1 + bloom);
        const tilt = flowerBaseAngle + windForce * 0.14 + sway;
        ctx.rotate(tilt);

        // --- 1. Dreamy Atmospheric Petal Aura Glow ---
        if (bloom > 0.03) {
            const glowR = (85 + bloom * 95) * scale;
            const glow = ctx.createRadialGradient(0, -glowR * 0.28, 0, 0, -glowR * 0.28, glowR);
            const { h, s, l } = species.petal.glowHsl;
            glow.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${0.25 * bloom})`);
            glow.addColorStop(0.5, `hsla(${h}, ${s}%, ${l - 12}%, ${0.08 * bloom})`);
            glow.addColorStop(1, `hsla(${h}, ${s}%, 15%, 0)`);

            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, -glowR * 0.28, glowR, 0, Math.PI * 2);
            ctx.fill();
        }

        // Petal dimensions: graceful lanceolate tepals with organic soft curvature
        const maxPetalLength = (88 + bloom * 36) * scale;
        const petalWidth = (34 + bloom * 22) * scale;

        // 6 Tepals (3 Outer Sepals/Tepals behind, 3 Inner Petals in front)
        // With organic asymmetry in angles and curves:
        const outerTepals = [
            { baseAngle: -Math.PI / 2,     lengthMul: 1.04, widthMul: 0.88, curlFactor: 1.10, idx: 0 },
            { baseAngle: -Math.PI * 0.85,  lengthMul: 0.96, widthMul: 0.86, curlFactor: 1.05, idx: 1 },
            { baseAngle: -Math.PI * 0.15,  lengthMul: 0.96, widthMul: 0.86, curlFactor: 1.05, idx: 2 }
        ];

        const innerTepals = [
            { baseAngle: -Math.PI * 0.69,  lengthMul: 1.00, widthMul: 1.06, curlFactor: 1.20, idx: 3 },
            { baseAngle: -Math.PI * 0.31,  lengthMul: 1.00, widthMul: 1.06, curlFactor: 1.20, idx: 4 },
            { baseAngle: Math.PI * 0.46,   lengthMul: 0.84, widthMul: 0.94, curlFactor: 0.92, idx: 5 } // lower petal in soft perspective
        ];

        // --- 2. Render Outer Tepals (Back Layer) ---
        for (const p of outerTepals) {
            this.drawSoftPetal(ctx, p, bloom, windForce, time, maxPetalLength, petalWidth, scale, species, false, variantSeed);
        }

        // --- 3. Soft Velvet Throat Shadow Depth ---
        if (bloom > 0.08) {
            ctx.save();
            ctx.fillStyle = species.center.throatBase;
            ctx.shadowBlur = 10 * scale;
            ctx.shadowColor = '#000000';
            ctx.beginPath();
            ctx.ellipse(0, 0, 13 * scale * bloom, 9 * scale * bloom, 0, 0, Math.PI * 2);
            ctx.fill();

            // Inner translucent nectar glow
            const nGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 11 * scale * bloom);
            nGrad.addColorStop(0, species.center.nectarGland);
            nGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = nGrad;
            ctx.fill();
            ctx.restore();
        }

        // --- 4. Stamen, Pistil & Golden Pollen Anthers ---
        if (bloom > 0.12) {
            this.drawSoftReproductiveCore(ctx, bloom, windForce, time, scale, species, variantSeed);
        }

        // --- 5. Render Inner Tepals (Front Layer with soft overlapping folds) ---
        for (const p of innerTepals) {
            this.drawSoftPetal(ctx, p, bloom, windForce, time, maxPetalLength, petalWidth, scale, species, true, variantSeed);
        }

        ctx.restore();
    }

    /**
     * Renders a soft, non-geometric petal with gentle folds, rounded tip, and velvet translucency
     */
    drawSoftPetal(ctx, pConfig, bloom, windForce, time, maxLen, maxWid, scale, species, isInner, variantSeed) {
        ctx.save();

        // Flutter noise unique to each petal in the bouquet
        const flutter = this.noise.get(time * 1.3 + pConfig.idx * 1.7 + variantSeed, pConfig.idx + variantSeed) * 0.035 * (1 + bloom);
        const windFlex = windForce * 0.055;

        // Angle interpolation: from tight tender bud to open recurved flower
        const closedAngle = -Math.PI / 2 + (pConfig.baseAngle - (-Math.PI / 2)) * 0.12;
        const currentAngle = MathUtils.lerp(closedAngle, pConfig.baseAngle, MathUtils.easeOutCubic(bloom)) + flutter + windFlex;

        ctx.rotate(currentAngle);

        const len = maxLen * pConfig.lengthMul;
        const wid = maxWid * pConfig.widthMul * (0.32 + bloom * 0.68);

        // Recurve: gentle backward curl at tips as it blooms
        const curlBack = bloom * 24 * pConfig.curlFactor * scale;
        const tipX = len - curlBack * 0.42;
        const tipY = (pConfig.idx % 2 === 0 ? 1 : -1) * curlBack * 0.32;

        // Soft undulating belly control points (gentle organic folds)
        const bellyX = len * 0.48;
        const bellyTopY = -wid * 0.50;
        const bellyBotY = wid * 0.50;

        // --- A. Soft ambient occlusion shadow behind overlapping inner petals ---
        if (isInner) {
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.38)';
            ctx.shadowBlur = 8 * scale;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(bellyX * 0.6, bellyTopY, bellyX, bellyTopY, tipX, tipY);
            ctx.bezierCurveTo(bellyX, bellyBotY, bellyX * 0.6, bellyBotY, 0, 0);
            ctx.fillStyle = species.petal.deepBase;
            ctx.fill();
            ctx.restore();
        }

        // --- B. Main Velvet Petal Shading (Smooth rounded contour) ---
        const grad = ctx.createLinearGradient(0, 0, tipX, 0);
        grad.addColorStop(0.00, species.petal.deepBase);
        grad.addColorStop(0.22, species.petal.darkShadow);
        grad.addColorStop(0.58, species.petal.midTone);
        grad.addColorStop(0.86, species.petal.brightTone);
        grad.addColorStop(1.00, species.petal.specular);

        ctx.fillStyle = grad;
        ctx.shadowBlur = (8 + bloom * 12) * scale;
        ctx.shadowColor = species.accentGlow;

        // Shape with ROUNDED tip apex (avoiding any sharp needle points)
        const roundTipR = 6 * scale; // soft radius at petal apex

        ctx.beginPath();
        ctx.moveTo(0, 0);
        // Soft billowing upper margin
        ctx.bezierCurveTo(
            bellyX * 0.52, bellyTopY * 0.88,
            bellyX * 0.92, bellyTopY * 1.02,
            tipX - roundTipR, tipY - roundTipR * 0.4
        );
        // Soft rounded petal tip curve (smooth spoon-like arc)
        ctx.quadraticCurveTo(
            tipX + roundTipR * 0.8, tipY,
            tipX - roundTipR, tipY + roundTipR * 0.4
        );
        // Soft billowing lower margin
        ctx.bezierCurveTo(
            bellyX * 0.92, bellyBotY * 1.02,
            bellyX * 0.52, bellyBotY * 0.88,
            0, 0
        );
        ctx.closePath();
        ctx.fill();

        // --- C. Translucent Specular Sheen (Soft diffuse light on petal fold) ---
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const specGrad = ctx.createLinearGradient(0, -wid * 0.35, 0, wid * 0.35);
        specGrad.addColorStop(0, 'transparent');
        specGrad.addColorStop(0.5, species.petal.specular);
        specGrad.addColorStop(1, 'transparent');

        ctx.globalAlpha = 0.32 + bloom * 0.22;
        ctx.lineWidth = Math.max(1, wid * 0.26);
        ctx.strokeStyle = specGrad;
        ctx.beginPath();
        ctx.moveTo(len * 0.18, 0);
        ctx.quadraticCurveTo(bellyX, bellyTopY * 0.18, tipX * 0.82, tipY * 0.45);
        ctx.stroke();
        ctx.restore();

        // --- D. Delicate, Soft Midrib Nectar Furrow ---
        ctx.shadowBlur = 0;
        ctx.strokeStyle = species.petal.veinLine;
        ctx.lineWidth = 1.3 * scale;
        ctx.beginPath();
        ctx.moveTo(len * 0.1, 0);
        ctx.quadraticCurveTo(bellyX, 0, tipX * 0.88, tipY * 0.7);
        ctx.stroke();

        // --- E. Soft Botanical Papillae (Freckles) with Pollen Granules ---
        if (bloom > 0.15) {
            const freckles = this.frecklePatterns[(pConfig.idx + variantSeed) % this.frecklePatterns.length];
            const freckleAlpha = Math.min(0.85, (bloom - 0.15) * 1.8);

            ctx.save();
            ctx.globalAlpha = freckleAlpha;

            for (const f of freckles) {
                const fx = f.u * len;
                const fy = f.v * wid;
                const r = f.size * scale;

                // Soft velvet papilla
                ctx.fillStyle = species.petal.freckleColor;
                ctx.beginPath();
                ctx.arc(fx, fy, r, 0, Math.PI * 2);
                ctx.fill();

                // Warm golden pollen speck atop center
                if (f.size > 1.3) {
                    ctx.fillStyle = species.petal.freckleGlow;
                    ctx.beginPath();
                    ctx.arc(fx + 0.3, fy - 0.2, r * 0.42, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }

        // --- F. Soft Translucent Petal Edge Rim ---
        ctx.save();
        ctx.strokeStyle = species.petal.rimLight;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 0.75;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    // =========================================================
    // SOFT REPRODUCTIVE CORE (STAMENS + PISTIL + POLLEN)
    // =========================================================

    drawSoftReproductiveCore(ctx, bloom, windForce, time, scale, species, variantSeed) {
        ctx.save();

        const stamenCount = 6;
        const center = species.center;
        const filamentLen = (40 + bloom * 30) * scale;

        // 1. Central Arching Pistil (Style + 3-lobed Stigma)
        const pistilLen = filamentLen * 1.22;
        const styleSway = this.noise.get(time * 0.85 + variantSeed, 8) * 3.5 * scale;
        const pistilTipX = Math.cos(-Math.PI / 2 + 0.08) * pistilLen + windForce * 5 + styleSway;
        const pistilTipY = Math.sin(-Math.PI / 2 + 0.08) * pistilLen;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = center.styleColor;
        ctx.lineWidth = 2.8 * scale;
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(pistilTipX * 0.5 + 3, pistilTipY * 0.5, pistilTipX, pistilTipY);
        ctx.stroke();

        // Soft 3-Lobed Stigma
        ctx.fillStyle = center.stigmaColor;
        ctx.shadowBlur = 5;
        ctx.shadowColor = center.styleColor;
        for (let lobe = 0; lobe < 3; lobe++) {
            const lAngle = (lobe * Math.PI * 2) / 3 + time * 0.15;
            const lx = pistilTipX + Math.cos(lAngle) * 3.4 * scale;
            const ly = pistilTipY + Math.sin(lAngle) * 3.4 * scale;
            ctx.beginPath();
            ctx.arc(lx, ly, 2.9 * scale, 0, Math.PI * 2);
            ctx.fill();
        }
        // Soft dewdrop glint
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(pistilTipX, pistilTipY - 1, 1.1 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. 6 Arching Filaments with Versatile Golden Pollen Anthers
        for (let i = 0; i < stamenCount; i++) {
            const radAngle = (i / stamenCount) * Math.PI * 2 + (i % 2 === 0 ? 0.1 : -0.1);
            const spreadRad = (20 + bloom * 34) * scale;
            const fFlutter = this.noise.get(time * 1.1 + i * 1.4 + variantSeed, 9 + i) * 3.2 * scale;

            const targetX = Math.cos(radAngle) * spreadRad + windForce * 3.5 + fFlutter;
            const targetY = Math.sin(radAngle) * spreadRad * 0.85 - (22 + bloom * 16) * scale;

            // Translucent arching filament stalk
            const fGrad = ctx.createLinearGradient(0, 0, targetX, targetY);
            fGrad.addColorStop(0, center.filamentBase);
            fGrad.addColorStop(1, center.filamentTip);

            ctx.save();
            ctx.strokeStyle = fGrad;
            ctx.lineWidth = 1.8 * scale;
            ctx.shadowBlur = 2;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(targetX * 0.4, targetY * 0.7 + 5, targetX, targetY);
            ctx.stroke();

            // Versatile golden anther
            this.drawSoftAnther(ctx, targetX, targetY, radAngle, scale, center);
            ctx.restore();
        }

        ctx.restore();
    }

    /**
     * Soft velvety anther loaded with golden pollen dust and rounded edges
     */
    drawSoftAnther(ctx, x, y, angle, scale, center) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + Math.PI / 2);

        const antherL = 11 * scale;
        const antherW = 5.0 * scale;

        // Rounded bronze body
        ctx.fillStyle = center.antherBody;
        ctx.shadowBlur = 5 * scale;
        ctx.shadowColor = center.pollenDust;
        ctx.beginPath();
        ctx.roundRect(-antherL / 2, -antherW / 2, antherL, antherW, 2.5 * scale);
        ctx.fill();

        // Velvety pollen sacs
        ctx.fillStyle = center.pollenDust;
        ctx.shadowBlur = 7;
        ctx.shadowColor = center.pollenDust;
        ctx.beginPath();
        ctx.ellipse(-antherL * 0.22, 0, antherL * 0.22, antherW * 0.38, 0, 0, Math.PI * 2);
        ctx.ellipse(antherL * 0.22, 0, antherL * 0.22, antherW * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();

        // Golden pollen shimmer
        ctx.fillStyle = center.pollenSparkle;
        ctx.shadowBlur = 3;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath();
        ctx.arc(-antherL * 0.2, -antherW * 0.18, 1.1 * scale, 0, Math.PI * 2);
        ctx.arc(antherL * 0.2, antherW * 0.18, 0.9 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

window.LilyRenderer = LilyRenderer;
