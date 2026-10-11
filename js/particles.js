/* =============================================================
   PARTICLE & POLLEN SPARKLE SYSTEM (Optimized Phase 1)
   - Pre-rendered offscreen sprite atlas for pollen & sparkles
   - Zero per-frame shadowBlur or string allocations
   - Fast 2D drawImage texture blitting
   - Object pooling for burst and ambient particles
   ============================================================= */

class PollenSpriteAtlas {
    constructor() {
        this.atlases = {}; // speciesId -> HTMLCanvasElement
        this.cellSize = 48; // Cell size in pixels (fits 3px core + 16px shadowBlur halo)
        this.coreRadius = 3.0; // Base core radius rendered into atlas cell
    }

    getAtlas(speciesConfig) {
        const id = (speciesConfig && speciesConfig.id) ? speciesConfig.id : 'blue';
        if (this.atlases[id]) {
            return this.atlases[id];
        }
        const canvas = this.createAtlasCanvas(speciesConfig);
        this.atlases[id] = canvas;
        return canvas;
    }

    createAtlasCanvas(speciesConfig) {
        const pollen = (speciesConfig && speciesConfig.pollen)
            ? speciesConfig.pollen
            : { hue: 45, sat: 100, light: 65 };

        const baseHue = pollen.hue;
        const sat = pollen.sat;
        const baseLight = pollen.light;

        const cellSize = this.cellSize;
        const cols = 5; // 5 color variations
        const rows = 4; // Row 0: pollen normal, Row 1: pollen specular, Row 2: ambient normal, Row 3: ambient specular

        const canvas = document.createElement('canvas');
        canvas.width = cols * cellSize;
        canvas.height = rows * cellSize;
        const ctx = canvas.getContext('2d');

        const hueOffsets = [-10, -5, 0, 5, 10];

        for (let r = 0; r < rows; r++) {
            const isPollenGrain = (r === 0 || r === 1);
            const isSpecular = (r === 1 || r === 3);

            for (let c = 0; c < cols; c++) {
                const cellX = c * cellSize;
                const cellY = r * cellSize;
                const centerX = cellX + cellSize * 0.5;
                const centerY = cellY + cellSize * 0.5;

                const hueOffset = isPollenGrain ? 0 : hueOffsets[c];
                const hue = ((baseHue + hueOffset) % 360 + 360) % 360;
                const light = isPollenGrain ? baseLight + 10 : baseLight;
                const blurRadius = isPollenGrain ? 10 : 5;

                ctx.save();
                ctx.shadowBlur = blurRadius;
                ctx.shadowColor = `hsla(${hue}, ${sat}%, ${light}%, 0.8)`;
                ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, 1)`;

                ctx.beginPath();
                ctx.arc(centerX, centerY, this.coreRadius, 0, Math.PI * 2);
                ctx.fill();

                if (isSpecular) {
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 4;
                    ctx.shadowColor = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, this.coreRadius * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        }

        return canvas;
    }
}

class PollenParticle {
    constructor(cw, ch, species) {
        this.cw = cw;
        this.ch = ch;
        this.species = species;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = 1;
        this.life = 0;
        this.maxLife = 1;
        this.isPollenGrain = false;
        this.variantIndex = 0;
        this.flickerSpeed = 0;
        this.flickerPhase = 0;
        this.oscillationFreq = 0;
        this.oscillationAmp = 0;
        this.reset(true);
    }

    reset(initial = false, emitterOrigin = null) {
        if (emitterOrigin) {
            // Spawn from flower center / anther area
            const spread = 25;
            this.x = emitterOrigin.x + (Math.random() - 0.5) * spread;
            this.y = emitterOrigin.y + (Math.random() - 0.5) * spread;
            this.vx = (Math.random() - 0.5) * 1.5;
            this.vy = -(Math.random() * 1.2 + 0.3);
            this.radius = Math.random() * 2.2 + 0.6;
            this.life = Math.random() * 180 + 100;
            this.isPollenGrain = true;
        } else {
            // Ambient drift mote
            this.x = Math.random() * this.cw;
            this.y = initial ? Math.random() * this.ch : this.ch + Math.random() * 30;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = -(Math.random() * 0.5 + 0.15);
            this.radius = Math.random() * 2.0 + 0.5;
            this.life = Math.random() * 320 + 160;
            this.isPollenGrain = Math.random() > 0.4;
        }

        this.maxLife = this.life;
        this.flickerSpeed = Math.random() * 0.08 + 0.04;
        this.flickerPhase = Math.random() * Math.PI * 2;
        this.oscillationFreq = Math.random() * 0.03 + 0.01;
        this.oscillationAmp = Math.random() * 0.8 + 0.2;
        this.variantIndex = Math.floor(Math.random() * 5);
    }

    update(windForce, dt) {
        // Natural sine flutter on horizontal movement
        const flutter = Math.sin(this.life * this.oscillationFreq + this.flickerPhase) * this.oscillationAmp;

        this.x += (this.vx + flutter + windForce * 2.2) * dt;
        this.y += this.vy * dt;
        this.life -= dt;

        if (this.life <= 0 || this.y < -30 || this.x < -40 || this.x > this.cw + 40) {
            this.reset();
        }
    }

    draw(ctx, atlas) {
        const t = this.life / this.maxLife;
        // Glistening specular flicker
        const flicker = 0.4 + 0.6 * Math.sin(this.life * this.flickerSpeed + this.flickerPhase);
        const alpha = Math.sin(t * Math.PI) * flicker * 0.9;
        if (alpha < 0.01) return;

        const isSpecular = (this.radius > 1.4 && flicker > 0.8);
        const row = (this.isPollenGrain ? 0 : 2) + (isSpecular ? 1 : 0);
        const col = this.variantIndex;

        const cellSize = 48;
        const srcX = col * cellSize;
        const srcY = row * cellSize;

        const destSize = 16 * this.radius;
        const drawX = this.x - destSize * 0.5;
        const drawY = this.y - destSize * 0.5;

        ctx.globalAlpha = alpha;
        ctx.drawImage(atlas, srcX, srcY, cellSize, cellSize, drawX, drawY, destSize, destSize);
    }
}

class ParticleSystem {
    constructor(cw, ch) {
        this.cw = cw;
        this.ch = ch;
        this.maxAmbient = 75;
        this.maxBurst = 50;

        this.atlasManager = new PollenSpriteAtlas();

        // Fixed pools
        this.ambientParticles = [];
        for (let i = 0; i < this.maxAmbient; i++) {
            this.ambientParticles.push(new PollenParticle(cw, ch, 'blue'));
        }

        this.burstPool = [];
        for (let i = 0; i < this.maxBurst; i++) {
            this.burstPool.push(new PollenParticle(cw, ch, 'blue'));
        }
        this.activeBurstCount = 0;
    }

    resize(cw, ch) {
        this.cw = cw;
        this.ch = ch;
        for (let i = 0; i < this.maxAmbient; i++) {
            this.ambientParticles[i].cw = cw;
            this.ambientParticles[i].ch = ch;
        }
        for (let i = 0; i < this.maxBurst; i++) {
            this.burstPool[i].cw = cw;
            this.burstPool[i].ch = ch;
        }
    }

    /**
     * Spawn pollen dust bursting gently from blooming flower
     */
    emitPollen(origin, count = 2) {
        for (let i = 0; i < count; i++) {
            if (this.activeBurstCount < this.maxBurst) {
                const p = this.burstPool[this.activeBurstCount];
                p.reset(false, origin);
                this.activeBurstCount++;
            }
        }
    }

    update(windForce, dt) {
        for (let i = 0; i < this.maxAmbient; i++) {
            this.ambientParticles[i].update(windForce, dt);
        }

        for (let i = this.activeBurstCount - 1; i >= 0; i--) {
            const p = this.burstPool[i];
            p.update(windForce, dt);
            if (p.life <= 0 || p.y < -30) {
                // Recycle: swap with last active element and decrement count
                const lastIdx = this.activeBurstCount - 1;
                if (i !== lastIdx) {
                    this.burstPool[i] = this.burstPool[lastIdx];
                    this.burstPool[lastIdx] = p;
                }
                this.activeBurstCount--;
            }
        }
    }

    draw(ctx, speciesConfig) {
        const atlas = this.atlasManager.getAtlas(speciesConfig);

        for (let i = 0; i < this.maxAmbient; i++) {
            this.ambientParticles[i].draw(ctx, atlas);
        }

        for (let i = 0; i < this.activeBurstCount; i++) {
            this.burstPool[i].draw(ctx, atlas);
        }

        ctx.globalAlpha = 1.0;
    }
}

window.ParticleSystem = ParticleSystem;
