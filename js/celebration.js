/* =============================================================
   CINEMATIC FLORAL CELEBRATION & LARGE PETAL NAME FORMATION (Phase 2 Optimized)
   - Pre-rendered 12 high-resolution LargeLilyPetal variants into offscreen canvases
   - Zero per-frame shadowBlur (baked into texture atlas)
   - Fast 2D drawImage transforms for all 260 petals
   - Zero-allocation point mapping & cached name shape coordinates
   - Pure petal-only formation of "Srujana Charis"
   ============================================================= */

class LilyPetalAtlas {
    constructor() {
        this.atlases = {}; // speciesId -> Array of 12 texture objects
        this.numVariants = 12;
    }

    getPetalTextures(species) {
        const id = (species && species.id) ? species.id : 'blue';
        if (this.atlases[id]) {
            return this.atlases[id];
        }
        const textures = this.createPetalTextures(species);
        this.atlases[id] = textures;
        return textures;
    }

    createPetalTextures(species) {
        const textures = [];
        const numVariants = this.numVariants;

        for (let i = 0; i < numVariants; i++) {
            // Variations in aspect ratio and geometry per variant
            const lenMult = 0.85 + (i % 4) * 0.1;
            const widMult = 0.80 + ((i * 3) % 4) * 0.12;

            const baseLen = 80 * lenMult;
            const baseWid = 32 * widMult;
            const pad = 24; // Padding for baked shadowBlur accent glow

            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(baseLen + pad * 2);
            canvas.height = Math.ceil(baseWid + pad * 2);
            const ctx = canvas.getContext('2d');

            const originX = pad;
            const originY = canvas.height * 0.5;

            ctx.save();
            ctx.translate(originX, originY);

            // 1. Rich botanical silk shading matching current species
            const grad = ctx.createLinearGradient(0, 0, baseLen, 0);
            grad.addColorStop(0.00, species.petal.deepBase);
            grad.addColorStop(0.25, species.petal.darkShadow);
            grad.addColorStop(0.60, species.petal.midTone);
            grad.addColorStop(0.88, species.petal.brightTone);
            grad.addColorStop(1.00, species.petal.specular);

            ctx.fillStyle = grad;
            // Baked glow halo (replaces per-frame runtime shadowBlur!)
            ctx.shadowBlur = 12;
            ctx.shadowColor = species.accentGlow;

            const roundR = 6 + (i % 3) * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(baseLen * 0.42, -baseWid * 0.52, baseLen * 0.82, -baseWid * 0.44, baseLen - roundR, -roundR * 0.5);
            ctx.quadraticCurveTo(baseLen + roundR, 0, baseLen - roundR, roundR * 0.5);
            ctx.bezierCurveTo(baseLen * 0.82, baseWid * 0.44, baseLen * 0.42, baseWid * 0.52, 0, 0);
            ctx.closePath();
            ctx.fill();

            // 2. Soft translucent specular highlight fold
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.38;
            const specGrad = ctx.createLinearGradient(0, -baseWid * 0.3, 0, baseWid * 0.3);
            specGrad.addColorStop(0, 'transparent');
            specGrad.addColorStop(0.5, species.petal.specular);
            specGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = specGrad;
            ctx.shadowBlur = 0; // Turn off shadow for spec fold
            ctx.beginPath();
            ctx.ellipse(baseLen * 0.52, 0, baseLen * 0.4, baseWid * 0.28, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 3. Delicate midrib vein
            ctx.strokeStyle = species.petal.veinLine;
            ctx.lineWidth = 1.2;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(baseLen * 0.08, 0);
            ctx.quadraticCurveTo(baseLen * 0.5, (i % 2 === 0 ? 1 : -1) * 1.5, baseLen * 0.88, 0);
            ctx.stroke();

            ctx.restore();

            textures.push({
                canvas,
                originX,
                originY,
                baseLen,
                baseWid
            });
        }

        return textures;
    }
}

class LargeLilyPetal {
    constructor(cw, ch, speciesKey, id) {
        this.cw = cw;
        this.ch = ch;
        this.speciesKey = speciesKey;
        this.id = id;
        this.variantIndex = id % 12;
        this.reset(true);
    }

    reset(initial = false) {
        // Spawn across or above the screen
        this.x = Math.random() * this.cw;
        // Start higher up so they cascade down dramatically
        this.y = initial ? (Math.random() * this.ch * 0.9 - 100) : (-80 - Math.random() * (this.ch * 0.6));

        // Faster, more dynamic downward motion
        this.vy = Math.random() * 4.5 + 4.8; // Fast, energetic descent
        this.vx = (Math.random() - 0.5) * 4.2;

        // Big, natural lily petal scale
        this.scale = Math.random() * 0.35 + 0.85; // Large substantial scale
        this.length = (58 + Math.random() * 32) * this.scale;
        this.width = (24 + Math.random() * 14) * this.scale;

        // 3D tumble & rotation
        this.angle = Math.random() * Math.PI * 2;
        this.vAngle = (Math.random() - 0.5) * 0.08;
        this.flip = Math.random() * Math.PI * 2;
        this.vFlip = (Math.random() - 0.5) * 0.12;

        // Letter assembly properties
        this.targetX = null;
        this.targetY = null;
        this.targetAngle = 0;
        this.targetScale = 0.75;
        this.isAssigned = false;
        this.settled = false;

        this.flutterPhase = Math.random() * Math.PI * 2;
        this.opacity = Math.random() * 0.15 + 0.85;
    }

    update(dt, phase, windForce, time) {
        if (phase === 'storm') {
            // Fast, energetic, swirling cascade across the whole screen
            const swirl = Math.sin(time * 2.2 + this.flutterPhase) * 3.8;
            this.x += (this.vx + swirl + windForce * 3.5) * dt;
            this.y += this.vy * dt;
            this.angle += this.vAngle * dt;
            this.flip += this.vFlip * dt;

            // Screen wrapping during storm
            if (this.y > this.ch + 80) {
                this.y = -80;
                this.x = Math.random() * this.cw;
            }
            if (this.x < -100) this.x = this.cw + 60;
            if (this.x > this.cw + 100) this.x = -60;
        } else if (phase === 'assemble' || phase === 'reveal') {
            if (this.targetX !== null && this.targetY !== null) {
                // Organic magnetic attraction towards letter target
                const dx = this.targetX - this.x;
                const dy = this.targetY - this.y;
                const dist = Math.hypot(dx, dy);

                // Smooth deceleration into letter formation
                const speed = Math.min(0.12 * dt, 0.15);
                this.x += dx * speed;
                this.y += dy * speed;

                // Rotate gently into the letter curve tangent
                let diffAngle = this.targetAngle - this.angle;
                while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
                while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
                this.angle += diffAngle * 0.1 * dt;

                // Flatten out tumble for clear visual readability of the name
                let diffFlip = 0 - this.flip;
                while (diffFlip < -Math.PI) diffFlip += Math.PI * 2;
                while (diffFlip > Math.PI) diffFlip -= Math.PI * 2;
                this.flip += diffFlip * 0.12 * dt;

                // Settle into target scale
                this.scale += (this.targetScale - this.scale) * 0.08 * dt;

                if (dist < 5) {
                    this.settled = true;
                    // Delicate living breath flutter once assembled
                    this.x += Math.sin(time * 2.5 + this.flutterPhase) * 0.45;
                    this.y += Math.cos(time * 2.1 + this.flutterPhase) * 0.45;
                }
            } else {
                // Floating accent petals that gently frame the name
                this.y += (this.vy * 0.35) * dt;
                this.x += Math.sin(time * 1.5 + this.flutterPhase) * 1.2 * dt;
                this.angle += this.vAngle * 0.4 * dt;
                if (this.y > this.ch + 80) {
                    this.y = -60;
                    this.x = Math.random() * this.cw;
                }
            }
        }
    }

    draw(ctx, petalTexture) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 3D perspective fold simulation
        const cosFlip = Math.cos(this.flip);
        const flipScale = Math.max(0.2, Math.abs(cosFlip));

        const scaleX = (this.length / petalTexture.baseLen) * this.scale;
        const scaleY = (this.width / petalTexture.baseWid) * this.scale * flipScale;

        ctx.scale(scaleX, scaleY);
        ctx.globalAlpha = this.opacity;

        ctx.drawImage(
            petalTexture.canvas,
            -petalTexture.originX,
            -petalTexture.originY
        );

        ctx.restore();
    }
}

class CelebrationManager {
    constructor() {
        // Phases: 'idle' -> 'expand' -> 'storm' -> 'assemble' -> 'reveal'
        this.state = 'idle';
        this.timer = 0;
        this.stemsAlpha = 1.0; // 1 = visible, 0 = completely hidden
        this.expansionScale = 1.0;
        this.expansionAlpha = 0;
        this.revealDuration = 18.0; // Stay clearly visible for 18+ seconds

        this.cw = window.innerWidth;
        this.ch = window.innerHeight;

        this.petals = [];
        this.maxPetals = 260; // Dense screen coverage with BIG petals

        this.atlasManager = new LilyPetalAtlas();

        this.nameNormalizedPoints = null;
        this.namePoints = [];

        this.initPetals();
        this.sampleNamePoints();

        window.addEventListener('resize', () => {
            this.cw = window.innerWidth;
            this.ch = window.innerHeight;
            this.mapPointsToScreen();
        });
    }

    initPetals() {
        this.petals = [];
        for (let i = 0; i < this.maxPetals; i++) {
            this.petals.push(new LargeLilyPetal(this.cw, this.ch, 'blue', i));
        }
    }

    /**
     * Samples dense stroke coordinates for "Srujana Charis" once and caches them.
     */
    sampleNamePoints() {
        if (this.nameNormalizedPoints) {
            this.mapPointsToScreen();
            return;
        }

        const off = document.createElement('canvas');
        const offCtx = off.getContext('2d');
        off.width = 1600;
        off.height = 420;

        offCtx.clearRect(0, 0, off.width, off.height);
        offCtx.fillStyle = '#ffffff';
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';

        offCtx.font = '700 96px "Playfair Display", "Cinzel", Georgia, serif';
        offCtx.fillText('Srujana Charis', off.width / 2, off.height / 2);

        const imgData = offCtx.getImageData(0, 0, off.width, off.height);
        const data = imgData.data;
        const candidates = [];

        const step = 6;
        for (let y = 10; y < off.height - 10; y += step) {
            for (let x = 10; x < off.width - 10; x += step) {
                const idx = (y * off.width + x) * 4;
                if (data[idx + 3] > 150) {
                    const gx = (data[idx + 4] || 0) - (data[idx - 4] || 0);
                    const gy = (data[idx + off.width * 4] || 0) - (data[idx - off.width * 4] || 0);
                    const tangentAngle = Math.atan2(gy, gx) + Math.PI / 2;

                    candidates.push({
                        nx: (x - off.width / 2) / (off.width / 2),
                        ny: (y - off.height / 2) / (off.height / 2),
                        angle: tangentAngle
                    });
                }
            }
        }

        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        this.nameNormalizedPoints = candidates.slice(0, 210);
        this.mapPointsToScreen();
    }

    mapPointsToScreen() {
        if (!this.nameNormalizedPoints || !this.nameNormalizedPoints.length) return;

        const targetWidth = Math.min(this.cw * 0.88, 1150);
        const targetHeight = targetWidth * 0.26;
        const centerX = this.cw * 0.5;
        const centerY = this.ch * 0.46;

        if (this.namePoints.length !== this.nameNormalizedPoints.length) {
            this.namePoints = this.nameNormalizedPoints.map(pt => ({
                x: 0,
                y: 0,
                angle: 0,
                rawAngle: pt.angle
            }));
        }

        for (let i = 0; i < this.nameNormalizedPoints.length; i++) {
            const pt = this.nameNormalizedPoints[i];
            const np = this.namePoints[i];
            np.x = centerX + (pt.nx * targetWidth * 0.5);
            np.y = centerY + (pt.ny * targetHeight * 0.5);
            np.angle = np.rawAngle + (Math.sin(i * 1.7) * 0.2);
        }

        for (let i = 0; i < this.petals.length; i++) {
            if (i < this.namePoints.length) {
                this.petals[i].targetX = this.namePoints[i].x;
                this.petals[i].targetY = this.namePoints[i].y;
                this.petals[i].targetAngle = this.namePoints[i].angle;
                this.petals[i].isAssigned = true;
            } else {
                this.petals[i].targetX = null;
                this.petals[i].targetY = null;
                this.petals[i].isAssigned = false;
            }
        }
    }

    trigger() {
        if (this.state !== 'idle') return;
        this.state = 'expand';
        this.timer = 0;
        this.expansionScale = 1.0;
        this.expansionAlpha = 1.0;
        this.mapPointsToScreen();

        for (const p of this.petals) {
            p.reset(false);
        }
    }

    reset() {
        this.state = 'idle';
        this.timer = 0;
        this.stemsAlpha = 1.0;
        this.expansionScale = 1.0;
        this.expansionAlpha = 0;
    }

    update(dt, windForce, time) {
        if (this.state === 'idle') {
            this.stemsAlpha = 1.0;
            return;
        }

        this.timer += dt * 0.016;

        if (this.state === 'expand') {
            this.expansionScale += dt * 0.055;
            this.stemsAlpha = Math.max(0, this.stemsAlpha - dt * 0.06);

            if (this.timer > 1.2) {
                this.state = 'storm';
                this.stemsAlpha = 0;
            }
        } else if (this.state === 'storm') {
            this.stemsAlpha = 0;
            this.expansionAlpha = Math.max(0, this.expansionAlpha - dt * 0.04);

            if (this.timer > 4.5) {
                this.state = 'assemble';
            }
        } else if (this.state === 'assemble') {
            this.stemsAlpha = 0;
            if (this.timer > 7.2) {
                this.state = 'reveal';
            }
        } else if (this.state === 'reveal') {
            this.stemsAlpha = 0;
            if (this.timer > 7.2 + this.revealDuration) {
                this.stemsAlpha = Math.min(1.0, (this.timer - (7.2 + this.revealDuration)) * 0.2);
                if (this.stemsAlpha >= 1.0) {
                    this.state = 'idle';
                }
            }
        }

        for (const p of this.petals) {
            p.update(dt, this.state, windForce, time);
        }
    }

    draw(ctx, species, smoothedFaceBox = null) {
        if (this.state === 'idle') return;

        // 1. Full-screen bloom expansion flash
        if (this.expansionAlpha > 0.01) {
            this.drawBloomExpansionFlash(ctx, species);
        }

        // 2. Draw dense falling / assembled BIG lily petals using texture blitting
        const textures = this.atlasManager.getPetalTextures(species);
        const numTextures = textures.length;

        for (let i = 0; i < this.petals.length; i++) {
            const p = this.petals[i];
            const texture = textures[p.variantIndex % numTextures];
            p.draw(ctx, texture);
        }
    }

    drawBloomExpansionFlash(ctx, species) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const cx = this.cw * 0.68;
        const cy = this.ch * 0.52;
        const maxR = Math.max(this.cw, this.ch) * 0.85 * this.expansionScale;

        const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        radGrad.addColorStop(0, species.accentGlow);
        radGrad.addColorStop(0.4, species.petal.specular);
        radGrad.addColorStop(0.7, species.themeBorder);
        radGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = radGrad;
        ctx.globalAlpha = Math.min(0.75, this.expansionAlpha * 0.8);
        ctx.beginPath();
        ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

window.CelebrationManager = CelebrationManager;
