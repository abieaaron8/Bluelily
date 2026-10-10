/* =============================================================
   PARTICLE & POLLEN SPARKLE SYSTEM
   Generates drifting pollen motes, glistening sparkles,
   and dynamic wind-swept golden botanical pollen dust.
   ============================================================= */

class PollenParticle {
    constructor(cw, ch, species) {
        this.cw = cw;
        this.ch = ch;
        this.species = species;
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

    draw(ctx, speciesConfig) {
        const t = this.life / this.maxLife;
        // Glistening specular flicker
        const flicker = 0.4 + 0.6 * Math.sin(this.life * this.flickerSpeed + this.flickerPhase);
        const alpha = Math.sin(t * Math.PI) * flicker * 0.9;
        if (alpha < 0.01) return;

        ctx.save();
        ctx.globalAlpha = alpha;

        const pollen = speciesConfig.pollen;
        const hue = this.isPollenGrain ? pollen.hue : pollen.hue + (Math.random() * 20 - 10);
        const sat = pollen.sat;
        const light = this.isPollenGrain ? pollen.light + 10 : pollen.light;

        // Glowing halo for golden pollen sparkles
        ctx.shadowBlur = this.isPollenGrain ? 10 : 5;
        ctx.shadowColor = `hsla(${hue}, ${sat}%, ${light}%, 0.8)`;
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, 1)`;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Extra specular glint on prominent pollen
        if (this.radius > 1.4 && flicker > 0.8) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

class ParticleSystem {
    constructor(cw, ch) {
        this.cw = cw;
        this.ch = ch;
        this.ambientParticles = [];
        this.burstParticles = [];
        this.maxAmbient = 75;
        this.maxBurst = 50;

        for (let i = 0; i < this.maxAmbient; i++) {
            this.ambientParticles.push(new PollenParticle(cw, ch, 'blue'));
        }
    }

    resize(cw, ch) {
        this.cw = cw;
        this.ch = ch;
        for (const p of this.ambientParticles) {
            p.cw = cw;
            p.ch = ch;
        }
        for (const p of this.burstParticles) {
            p.cw = cw;
            p.ch = ch;
        }
    }

    /**
     * Spawn pollen dust bursting gently from blooming flower
     */
    emitPollen(origin, count = 2) {
        for (let i = 0; i < count; i++) {
            if (this.burstParticles.length < this.maxBurst) {
                const p = new PollenParticle(this.cw, this.ch, 'blue');
                p.reset(false, origin);
                this.burstParticles.push(p);
            }
        }
    }

    update(windForce, dt) {
        for (const p of this.ambientParticles) {
            p.update(windForce, dt);
        }

        for (let i = this.burstParticles.length - 1; i >= 0; i--) {
            const p = this.burstParticles[i];
            p.update(windForce, dt);
            if (p.life <= 0 || p.y < -30) {
                this.burstParticles.splice(i, 1);
            }
        }
    }

    draw(ctx, speciesConfig) {
        for (const p of this.ambientParticles) {
            p.draw(ctx, speciesConfig);
        }
        for (const p of this.burstParticles) {
            p.draw(ctx, speciesConfig);
        }
    }
}

window.ParticleSystem = ParticleSystem;
