/* =============================================================
   GLASSMORPHIC BOTANICAL UI MANAGER
   Controls species selection, adaptive color theming,
   live telemetry metrics (Bloom, Growth, Wind),
   instruction pills, and tracking status badges.
   ============================================================= */

class UIManager {
    constructor(options = {}) {
        this.onSpeciesChange = options.onSpeciesChange || (() => {});

        // DOM elements
        this.root = document.documentElement;
        this.instructionsPill = document.getElementById('instructions');
        this.statusBadge = document.getElementById('status-badge');
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('status-text');

        // Species buttons
        this.btnBlue = document.getElementById('species-blue');
        this.btnMaroon = document.getElementById('species-maroon');

        // Metric displays
        this.valBloom = document.getElementById('val-bloom');
        this.barBloom = document.getElementById('bar-bloom');
        this.valGrowth = document.getElementById('val-growth');
        this.barGrowth = document.getElementById('bar-growth');
        this.valWind = document.getElementById('val-wind');
        this.barWind = document.getElementById('bar-wind');

        this.initEventListeners();
        this.applyTheme('blue');

        // Auto-fade instruction pill after 9 seconds, but allow manual toggle/hover
        if (this.instructionsPill) {
            setTimeout(() => {
                this.instructionsPill.classList.add('collapsed');
            }, 9000);
        }
    }

    initEventListeners() {
        if (this.btnBlue) {
            this.btnBlue.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectSpecies('blue');
            });
        }
        if (this.btnMaroon) {
            this.btnMaroon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectSpecies('maroon');
            });
        }

        if (this.instructionsPill) {
            this.instructionsPill.addEventListener('click', (e) => {
                e.stopPropagation();
                this.instructionsPill.classList.toggle('collapsed');
            });
        }
    }

    selectSpecies(speciesKey) {
        if (!LILY_SPECIES[speciesKey]) return;

        // Toggle active button class
        if (this.btnBlue) this.btnBlue.classList.toggle('active', speciesKey === 'blue');
        if (this.btnMaroon) this.btnMaroon.classList.toggle('active', speciesKey === 'maroon');

        this.applyTheme(speciesKey);
        this.onSpeciesChange(speciesKey);
    }

    applyTheme(speciesKey) {
        const spec = LILY_SPECIES[speciesKey];
        if (!spec) return;

        this.root.style.setProperty('--theme-accent', spec.accentColor);
        this.root.style.setProperty('--theme-glow', spec.accentGlow);
        this.root.style.setProperty('--theme-border', spec.themeBorder);
        this.root.style.setProperty('--theme-bg-tint', spec.themeBg);
    }

    setStatus(text, state = 'active') {
        if (this.statusText) this.statusText.textContent = text;
        if (this.statusDot) {
            this.statusDot.className = 'status-dot ' + state;
        }
    }

    updateTrackingStatus(handsCount) {
        if (!this.statusText) return;
        if (handsCount === 0) {
            this.setStatus('Show hands to camera', 'searching');
        } else if (handsCount === 1) {
            this.setStatus('1 Hand Detected', 'active');
        } else {
            this.setStatus('Dual Hands Active', 'active');
        }
    }

    updateMetrics(bloom, growth, wind) {
        const bloomPct = Math.round(Math.min(1, Math.max(0, bloom)) * 100);
        const growthPct = Math.round(Math.min(1, Math.max(0, growth)) * 100);
        const windNorm = Math.min(100, Math.round(Math.abs(wind) * 45));

        if (this.valBloom) this.valBloom.textContent = `${bloomPct}%`;
        if (this.barBloom) this.barBloom.style.width = `${bloomPct}%`;

        if (this.valGrowth) this.valGrowth.textContent = `${growthPct}%`;
        if (this.barGrowth) this.barGrowth.style.width = `${growthPct}%`;

        if (this.valWind) this.valWind.textContent = `${(wind).toFixed(1)}`;
        if (this.barWind) this.barWind.style.width = `${windNorm}%`;
    }
}

window.UIManager = UIManager;
