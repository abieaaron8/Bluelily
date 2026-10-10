/* =============================================================
   CINEMATIC FLORAL CELEBRATION & LARGE PETAL NAME FORMATION
   - Full-screen floral bloom surge & dissolution
   - Screen-filling dramatic cascade of BIG realistic lily petals
   - Dynamic, faster downward motion & 3D tumbling
   - Complete removal of stems during sequence
   - Petals gather to form large, highly legible "Srujana Charis"
   - Extended display duration for clear, breathtaking viewing
   ============================================================= */

class LargeLilyPetal {
    constructor(cw, ch, speciesKey, id) {
        this.cw = cw;
        this.ch = ch;
        this.speciesKey = speciesKey;
        this.id = id;
        this.reset(true);
    }

    reset(initial = false) {
        // Spawn across or above the screen
        this.x = Math.random() * this.cw;
        // Start higher up so they cascade down dramatically
        this.y = initial ? (Math.random() * this.ch * 0.9 - 100) : (-80 - Math.random() * (this.ch * 0.6));

        // Faster, more dynamic downward motion as requested
        this.vy = Math.random() * 4.5 + 4.8; // Fast, energetic descent
        this.vx = (Math.random() - 0.5) * 4.2;

        // Big, natural lily petal scale (NOT tiny confetti!)
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

    draw(ctx, species) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 3D perspective fold simulation
        const cosFlip = Math.cos(this.flip);
        ctx.scale(1, Math.max(0.2, Math.abs(cosFlip)));

        const len = this.length * this.scale;
        const wid = this.width * this.scale;

        // Rich botanical silk shading matching current species
        const grad = ctx.createLinearGradient(0, 0, len, 0);
        grad.addColorStop(0.00, species.petal.deepBase);
        grad.addColorStop(0.25, species.petal.darkShadow);
        grad.addColorStop(0.60, species.petal.midTone);
        grad.addColorStop(0.88, species.petal.brightTone);
        grad.addColorStop(1.00, species.petal.specular);

        ctx.fillStyle = grad;
        ctx.globalAlpha = this.opacity;
        ctx.shadowBlur = 12 * this.scale;
        ctx.shadowColor = species.accentGlow;

        // Natural, soft rounded petal apex (NO needle points)
        const roundR = 7 * this.scale;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(len * 0.42, -wid * 0.52, len * 0.82, -wid * 0.44, len - roundR, -roundR * 0.5);
        ctx.quadraticCurveTo(len + roundR, 0, len - roundR, roundR * 0.5);
        ctx.bezierCurveTo(len * 0.82, wid * 0.44, len * 0.42, wid * 0.52, 0, 0);
        ctx.closePath();
        ctx.fill();

        // Soft translucent specular highlight fold
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.38;
        const specGrad = ctx.createLinearGradient(0, -wid * 0.3, 0, wid * 0.3);
        specGrad.addColorStop(0, 'transparent');
        specGrad.addColorStop(0.5, species.petal.specular);
        specGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = specGrad;
        ctx.beginPath();
        ctx.ellipse(len * 0.52, 0, len * 0.4, wid * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Delicate midrib vein
        ctx.strokeStyle = species.petal.veinLine;
        ctx.lineWidth = 1.2 * this.scale;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(len * 0.08, 0);
        ctx.quadraticCurveTo(len * 0.5, 0, len * 0.88, 0);
        ctx.stroke();

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

        this.namePoints = [];
        this.initPetals();
        this.sampleNamePoints();

        window.addEventListener('resize', () => {
            this.cw = window.innerWidth;
            this.ch = window.innerHeight;
            this.sampleNamePoints();
        });
    }

    initPetals() {
        this.petals = [];
        for (let i = 0; i < this.maxPetals; i++) {
            this.petals.push(new LargeLilyPetal(this.cw, this.ch, 'blue', i));
        }
    }

    /**
     * Samples dense, highly legible stroke coordinates for "Srujana Charis"
     */
    sampleNamePoints() {
        const off = document.createElement('canvas');
        const offCtx = off.getContext('2d');
        off.width = 1600;
        off.height = 420;

        offCtx.clearRect(0, 0, off.width, off.height);
        offCtx.fillStyle = '#ffffff';
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';

        // Elegant display font with high stroke clarity
        offCtx.font = '700 96px "Playfair Display", "Cinzel", Georgia, serif';
        offCtx.fillText('Srujana Charis', off.width / 2, off.height / 2);

        const imgData = offCtx.getImageData(0, 0, off.width, off.height);
        const data = imgData.data;
        const candidates = [];

        // Scan high-density points
        const step = 6;
        for (let y = 10; y < off.height - 10; y += step) {
            for (let x = 10; x < off.width - 10; x += step) {
                const idx = (y * off.width + x) * 4;
                if (data[idx + 3] > 150) {
                    // Compute local stroke tangent gradient for petal alignment
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

        // Shuffle with deterministic distribution
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        // Pick ~210 evenly distributed letter stroke points
        this.nameNormalizedPoints = candidates.slice(0, 210);
        this.mapPointsToScreen();
    }

    mapPointsToScreen() {
        // Large, centered, prominent text width across screen
        const targetWidth = Math.min(this.cw * 0.88, 1150);
        const targetHeight = targetWidth * 0.26;
        const centerX = this.cw * 0.5;
        const centerY = this.ch * 0.46; // Centered vertically

        this.namePoints = this.nameNormalizedPoints.map((pt) => {
            return {
                x: centerX + (pt.nx * targetWidth * 0.5),
                y: centerY + (pt.ny * targetHeight * 0.5),
                angle: pt.angle + (Math.random() - 0.5) * 0.4
            };
        });

        // Assign targets to petals
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

    /**
     * Triggers the grand cinematic celebration sequence!
     */
    trigger() {
        if (this.state !== 'idle') return;
        this.state = 'expand';
        this.timer = 0;
        this.expansionScale = 1.0;
        this.expansionAlpha = 1.0;
        this.mapPointsToScreen();

        // Prepare petals for dramatic cascade
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

        // Sequence Progression:
        // 0.0s - 1.2s: 'expand' - Main flower expands into full-screen bloom; stems fade out completely
        // 1.2s - 4.5s: 'storm'  - Flower dissolves into dense, dramatic curtain of fast-falling BIG lily petals
        // 4.5s - 7.5s: 'assemble' - Petals gather and arrange into the name "Srujana Charis"
        // 7.5s - 25.0s+: 'reveal' - High legibility, large petal name displayed with gentle breathing flutter

        if (this.state === 'expand') {
            // Rapid expansion towards full screen
            this.expansionScale += dt * 0.055;
            // Stems vanish immediately!
            this.stemsAlpha = Math.max(0, this.stemsAlpha - dt * 0.06);

            if (this.timer > 1.2) {
                this.state = 'storm';
                this.stemsAlpha = 0; // Stems 100% removed
            }
        } else if (this.state === 'storm') {
            this.stemsAlpha = 0; // Stems remain completely gone
            // Dissolve expanding flower burst
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
            // Stays on screen for the full generous duration
            if (this.timer > 7.2 + this.revealDuration) {
                // Soft gradual return after extended display
                this.stemsAlpha = Math.min(1.0, (this.timer - (7.2 + this.revealDuration)) * 0.2);
                if (this.stemsAlpha >= 1.0) {
                    this.state = 'idle';
                }
            }
        }

        // Update all big petals
        for (const p of this.petals) {
            p.update(dt, this.state, windForce, time);
        }
    }

    draw(ctx, species) {
        if (this.state === 'idle') return;

        // 1. Full-screen bloom expansion aura & dissolve flash
        if (this.expansionAlpha > 0.01) {
            this.drawBloomExpansionFlash(ctx, species);
        }

        // 2. High-contrast botanical floral backdrop for pristine letter legibility
        if (this.state === 'assemble' || this.state === 'reveal') {
            this.drawNameUnderglow(ctx, species);
        }

        // 3. Draw dense falling / assembled BIG lily petals
        for (const p of this.petals) {
            p.draw(ctx, species);
        }

        // 4. Draw shimmering golden pollen sparkles across the assembled name
        if (this.state === 'assemble' || this.state === 'reveal') {
            this.drawNameStardust(ctx, species);
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

    drawNameUnderglow(ctx, species) {
        const cw = this.cw;
        const ch = this.ch;

        ctx.save();
        // Counter-flip for unmirrored text orientation on flipped canvas
        ctx.translate(cw, 0);
        ctx.scale(-1, 1);

        const targetWidth = Math.min(cw * 0.88, 1150);
        const fontSize = Math.round(targetWidth * 0.092);
        const textY = ch * 0.46;

        ctx.font = `700 ${fontSize}px "Playfair Display", "Cinzel", Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Deep velvet floral ambient shadow behind the petal letters for crisp contrast
        ctx.shadowBlur = 32;
        ctx.shadowColor = species.petal.deepBase;
        ctx.fillStyle = species.petal.darkShadow;
        ctx.globalAlpha = 0.55;
        ctx.fillText('Srujana Charis', cw * 0.5, textY);

        // Soft luminous floral rim glow
        ctx.strokeStyle = species.accentGlow;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 24;
        ctx.shadowColor = species.accentColor;
        ctx.globalAlpha = 0.45;
        ctx.strokeText('Srujana Charis', cw * 0.5, textY);

        ctx.restore();
    }

    drawNameStardust(ctx, species) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = '#ffe082';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffc129';

        const t = performance.now() * 0.002;
        for (let i = 0; i < 35; i++) {
            const pt = this.namePoints[(i * 6) % this.namePoints.length];
            if (pt) {
                const sx = pt.x + Math.sin(t * 1.5 + i) * 14;
                const sy = pt.y + Math.cos(t * 1.2 + i * 1.3) * 14;
                const r = Math.sin(t * 3.5 + i) * 1.6 + 2.2;
                if (r > 0.8) {
                    ctx.beginPath();
                    ctx.arc(sx, sy, r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }
}

window.CelebrationManager = CelebrationManager;
