/* =============================================================
   LILY BOTANICAL SPECIES DEFINITIONS
   Precise color palettes, gradients, petal speculars,
   papillae speckles, stamen details, and theme tokens
   for Celestial Blue Lily & Velvet Maroon Lily.
   ============================================================= */

const LILY_SPECIES = {
    blue: {
        id: 'blue',
        name: 'Sapphire Celestial Lily',
        scientificName: 'Lilium Caeruleum Rara',
        badgeColor: '#388bfd',
        accentGlow: 'rgba(56, 139, 253, 0.5)',
        accentColor: '#4ba0ff',
        themeBg: 'rgba(10, 20, 42, 0.75)',
        themeBorder: 'rgba(56, 139, 253, 0.3)',

        // Petal colors
        petal: {
            deepBase: '#08142e',        // Midnight indigo base
            darkShadow: '#0d224d',      // Deep petal shadow
            midTone: '#1b4fb8',         // Royal cobalt sapphire
            brightTone: '#3578e5',      // Luminous azure
            specular: '#8bc2ff',        // Pale cyan-blue specular reflection
            rimLight: '#bde0ff',        // Crisp delicate petal rim
            veinLine: 'rgba(110, 180, 255, 0.45)', // Nectar furrow midrib
            freckleColor: '#071126',     // Botanical papillae spots
            freckleGlow: '#ffcf52',      // Tiny golden pollen granules atop spots
            glowHsl: { h: 220, s: 95, l: 60 }
        },

        // Flower center & reproductive organs
        center: {
            throatBase: '#0a1d36',      // Deep inner throat darkness
            nectarGland: '#6ae0a6',     // Pale mint-celadon nectar groove
            filamentBase: '#8fe3bd',    // Translucent mint-jade filament stalk
            filamentTip: '#a8eed6',     // Pale cyan-mint upper stalk
            antherBody: '#c97712',      // Deep amber-bronze anther casing
            pollenDust: '#ffc129',      // Bright golden-amber pollen grains
            pollenSparkle: '#ffe58f',   // Highlight sparkle on pollen
            styleColor: '#8fe4be',      // Central pistil style
            stigmaColor: '#c5fae0'      // 3-lobed pistil stigma tip
        },

        // Foliage & Stem
        vegetative: {
            stemBase: '#1a4228',
            stemHighlight: '#2c6b41',
            stemGlow: 'rgba(44, 107, 65, 0.3)',
            leafBase: '#133821',
            leafMid: '#1e5433',
            leafHighlight: '#3c8f58',
            leafVein: 'rgba(90, 190, 125, 0.3)',
            budBase: '#1d482c',
            budTip: '#1b4fb8'
        },

        // Ambient particles & pollen
        pollen: {
            hue: 45,
            sat: 100,
            light: 65,
            dustAlpha: 0.85
        }
    },

    maroon: {
        id: 'maroon',
        name: 'Velvet Obsidian Lily',
        scientificName: 'Lilium Tenebris Velvet',
        badgeColor: '#e03b54',
        accentGlow: 'rgba(224, 59, 84, 0.5)',
        accentColor: '#ff5c77',
        themeBg: 'rgba(40, 10, 20, 0.75)',
        themeBorder: 'rgba(224, 59, 84, 0.3)',

        // Petal colors
        petal: {
            deepBase: '#180408',        // Black-cherry deep base
            darkShadow: '#2f0812',      // Deep wine-velvet shadow
            midTone: '#6b1325',         // Rich crimson maroon
            brightTone: '#a31f38',      // Lustrous garnet red
            specular: '#e85875',        // Soft rose-silk specular highlight
            rimLight: '#ff9cb0',        // Delicate blush-rose petal rim
            veinLine: 'rgba(235, 110, 135, 0.45)', // Midrib vein highlight
            freckleColor: '#120205',     // Dark burgundy papillae spots
            freckleGlow: '#ffb938',      // Golden pollen flecks atop spots
            glowHsl: { h: 345, s: 90, l: 55 }
        },

        // Flower center & reproductive organs
        center: {
            throatBase: '#140306',      // Velvet throat depth
            nectarGland: '#755832',     // Golden-olive nectar glow
            filamentBase: '#731424',    // Deep wine filament base
            filamentTip: '#a02339',     // Crimson filament tip
            antherBody: '#8c4210',      // Deep rustic bronze anther
            pollenDust: '#f59e1b',      // Velvety golden-amber pollen grains
            pollenSparkle: '#ffd670',   // Sunlit pollen highlight
            styleColor: '#6d1323',      // Deep ruby style
            stigmaColor: '#420b15'      // Deep velvety burgundy 3-lobed stigma
        },

        // Foliage & Stem
        vegetative: {
            stemBase: '#1d3822',
            stemHighlight: '#2e5836',
            stemGlow: 'rgba(46, 88, 54, 0.3)',
            leafBase: '#17301c',
            leafMid: '#244c2c',
            leafHighlight: '#407a4a',
            leafVein: 'rgba(100, 185, 120, 0.3)',
            budBase: '#253e28',
            budTip: '#781528'
        },

        // Ambient particles & pollen
        pollen: {
            hue: 38,
            sat: 100,
            light: 60,
            dustAlpha: 0.85
        }
    }
};

window.LILY_SPECIES = LILY_SPECIES;
