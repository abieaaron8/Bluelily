/* =============================================================
   CINEMATIC FLORAL CELEBRATION & BOTANICAL PETAL RAIN
   - Continuous cascading shower of rich silk botanical lily petals
   - Ambient wind responsiveness and flutter physics
   - Clean, cinematic visual experience: zero text, pure botanical motion
   - 120 FPS Zero-GC canvas rendering with pre-allocated offscreen petal textures
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
            const lenMult = 0.88 + (i % 4) * 0.08;
            const widMult = 0.82 + ((i * 3) % 4) * 0.10;

            const baseLen = 80 * lenMult;
            const baseWid = 32 * widMult;
            const pad = 16;

            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(baseLen + pad * 2);
            canvas.height = Math.ceil(baseWid + pad * 2);
            const ctx = canvas.getContext('2d');

            const originX = pad + baseLen * 0.5;
            const originY = canvas.height * 0.5;

            ctx.save();
            ctx.translate(originX, originY);

            const halfLen = baseLen * 0.5;

            // Rich botanical silk shading
            const grad = ctx.createLinearGradient(-halfLen, 0, halfLen, 0);
            grad.addColorStop(0.00, species.petal.deepBase);
            grad.addColorStop(0.25, species.petal.darkShadow);
            grad.addColorStop(0.60, species.petal.midTone);
            grad.addColorStop(0.88, species.petal.brightTone);
            grad.addColorStop(1.00, species.petal.specular);

            ctx.fillStyle = grad;
            ctx.shadowBlur = 4;
            ctx.shadowColor = species.accentGlow;

            const roundR = 6 + (i % 3) * 2;
            ctx.beginPath();
            ctx.moveTo(-halfLen, 0);
            ctx.bezierCurveTo(-halfLen + baseLen * 0.42, -baseWid * 0.52, -halfLen + baseLen * 0.82, -baseWid * 0.44, halfLen - roundR, -roundR * 0.5);
            ctx.quadraticCurveTo(halfLen + roundR, 0, halfLen - roundR, roundR * 0.5);
            ctx.bezierCurveTo(-halfLen + baseLen * 0.82, baseWid * 0.44, -halfLen + baseLen * 0.42, baseWid * 0.52, -halfLen, 0);
            ctx.closePath();
            ctx.fill();

            // Specular highlight fold
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.38;
            const specGrad = ctx.createLinearGradient(0, -baseWid * 0.3, 0, baseWid * 0.3);
            specGrad.addColorStop(0, 'transparent');
            specGrad.addColorStop(0.5, species.petal.specular);
            specGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = specGrad;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.ellipse(-halfLen + baseLen * 0.52, 0, baseLen * 0.4, baseWid * 0.28, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Midrib vein
            ctx.strokeStyle = species.petal.veinLine;
            ctx.lineWidth = 1.2;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(-halfLen + baseLen * 0.08, 0);
            ctx.quadraticCurveTo(0, (i % 2 === 0 ? 1 : -1) * 1.5, halfLen - baseLen * 0.12, 0);
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

        this.baseLength = 72;
        this.baseWidth = 30;

        this.reset(true);
    }

    reset(initial = false) {
        this.x = Math.random() * this.cw;
        this.y = initial ? (Math.random() * this.ch * 0.85 - 60) : (-60 - Math.random() * (this.ch * 0.5));

        this.vy = 2.4 + (this.id % 5) * 0.40;
        this.vx = (Math.random() - 0.5) * 1.8;

        this.scale = 0.80 + (this.id % 4) * 0.10;
        this.angle = Math.random() * Math.PI * 2;
        this.vAngle = ((this.id % 2 === 0 ? 1 : -1) * 0.016) + (Math.random() - 0.5) * 0.01;
        this.flip = Math.random() * Math.PI * 2;
        this.vFlip = (Math.random() - 0.5) * 0.03;

        this.flutterPhase = (this.id * 0.37) % (Math.PI * 2);
        this.opacity = 0.95;
    }

    update(dt, phase, windForce, time) {
        const sway = Math.sin(time * 1.8 + this.flutterPhase) * 1.4;
        const windEffect = windForce * 1.8;

        if (phase === 'storm' || phase === 'expand') {
            this.opacity = Math.min(0.95, this.opacity + dt * 0.05);
            this.x += (this.vx * 0.4 + sway + windEffect) * dt;
            this.y += this.vy * dt;
            this.angle += this.vAngle * dt;
            this.flip += this.vFlip * dt;

            if (this.y > this.ch + 70) {
                this.y = -60;
                this.x = Math.random() * this.cw;
            }
            if (this.x < -80) this.x = this.cw + 40;
            if (this.x > this.cw + 80) this.x = -40;
        } else if (phase === 'reveal') {
            // Full botanical opacity during falling petal rain sequence
            this.opacity = Math.min(0.95, this.opacity + dt * 0.02);
            this.x += (this.vx * 0.3 + sway * 0.7 + windEffect) * dt;
            this.y += (this.vy * 0.85) * dt;
            this.angle += this.vAngle * 0.7 * dt;
            this.flip += this.vFlip * 0.7 * dt;

            if (this.y > this.ch + 70) {
                this.y = -60;
                this.x = Math.random() * this.cw;
            }
        } else if (phase === 'fade') {
            this.opacity = Math.max(0, this.opacity - dt * 0.03);
            this.y += this.vy * dt;
        }
    }

    draw(ctx, petalTexture) {
        if (this.opacity <= 0.01) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const cosFlip = Math.cos(this.flip);
        const flipScale = Math.max(0.2, Math.abs(cosFlip));

        const scaleX = (this.baseLength / petalTexture.baseLen) * this.scale;
        const scaleY = (this.baseWidth / petalTexture.baseWid) * this.scale * flipScale;

        ctx.scale(scaleX, scaleY);

        let alpha = this.opacity;
        if (this.y < 0) {
            alpha *= MathUtils.clamp((this.y + 60) / 60, 0.2, 1.0);
        } else if (this.y > this.ch) {
            alpha *= MathUtils.clamp(1.0 - (this.y - this.ch) / 70, 0, 1.0);
        }
        ctx.globalAlpha = alpha;

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
        this.state = 'idle';
        this.timer = 0;
        this.stemsAlpha = 1.0;
        this.expansionScale = 1.0;
        this.expansionAlpha = 0;

        this.rainDuration = 18.0; // 18 seconds of graceful falling petal rain

        this.cw = window.innerWidth;
        this.ch = window.innerHeight;

        this.maxPetals = 160;
        this.petals = [];

        this.atlasManager = new LilyPetalAtlas();

        this.initPetals();

        window.addEventListener('resize', () => {
            this.cw = window.innerWidth;
            this.ch = window.innerHeight;
            for (const p of this.petals) {
                p.cw = this.cw;
                p.ch = this.ch;
            }
        });
    }

    initPetals() {
        this.petals = [];
        for (let i = 0; i < this.maxPetals; i++) {
            this.petals.push(new LargeLilyPetal(this.cw, this.ch, 'blue', i));
        }
    }

    trigger() {
        if (this.state !== 'idle') return;
        this.state = 'expand';
        this.timer = 0;
        this.expansionScale = 1.0;
        this.expansionAlpha = 1.0;

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

            // Transition into continuous falling petal rain sequence
            if (this.timer > 4.0) {
                this.state = 'reveal';
            }
        } else if (this.state === 'reveal') {
            this.stemsAlpha = 0;
            // Hold falling petal rain for duration
            if (this.timer > 4.0 + this.rainDuration) {
                this.state = 'fade';
            }
        } else if (this.state === 'fade') {
            const fadeElapsed = this.timer - (4.0 + this.rainDuration);
            this.stemsAlpha = Math.min(1.0, fadeElapsed * 0.35);

            if (this.stemsAlpha >= 1.0) {
                this.reset();
            }
        }

        for (const p of this.petals) {
            p.update(dt, this.state, windForce, time);
        }
    }

    draw(ctx, species, smoothedFaceBox = null) {
        if (this.state === 'idle') return;

        // 1. Bloom Expansion Flash
        if (this.expansionAlpha > 0.01) {
            this.drawBloomExpansionFlash(ctx, species);
        }

        // 2. Cascading Falling Lily Petals (Cinematic Botanical Rain)
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
