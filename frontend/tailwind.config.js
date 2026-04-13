/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand → Stitch Action Blue (#005ac6 = secondary) ─────────────────
        brand: {
          50:  '#eff5ff',
          100: '#d8e2ff',  // secondary-container
          200: '#c3d4ff',
          300: '#8aaeff',
          400: '#4d83f0',
          500: '#1a5fd4',
          600: '#005ac6',  // secondary (Stitch CTA Blue)
          700: '#004faf',  // secondary-dim
          800: '#003c88',
          900: '#002666',
        },

        // ── Gray → Stitch surface tiers ───────────────────────────────────────
        // Light: background progression (white cards on warm neutral base)
        // Dark: standard dark ramp (not in stitch spec, kept functional)
        gray: {
          50:  '#f9f9f9',  // surface
          100: '#f3f3f3',  // surface-container-low
          200: '#eeeeee',  // surface-container  → cards blend with background (No-Line Rule)
          300: '#e8e8e8',  // surface-container-high
          400: '#b2b2b2',  // outline-variant (dark mode secondary text)
          500: '#7b7b7b',  // outline           (~4.6:1 contrast on white ✓)
          600: '#5f5f5f',  // on-surface-variant
          700: '#3f3f3f',  // strong text, dark mode secondary
          800: '#2a2a2a',  // dark mode cards
          900: '#1a1a1a',  // dark mode background
        },

        // ── Stitch semantic tokens (Material Design 3) ───────────────────────
        // Primary brand signal
        'secondary':                  '#005ac6',
        'secondary-dim':              '#004faf',
        'secondary-container':        '#d8e2ff',
        'on-secondary':               '#f9f8ff',
        'on-secondary-container':     '#004dac',

        // Surface elevation hierarchy
        'surface':                    '#f9f9f9',
        'surface-dim':                '#dadada',
        'surface-bright':             '#f9f9f9',
        'surface-variant':            '#e2e2e2',
        'surface-container-lowest':   '#ffffff',
        'surface-container-low':      '#f3f3f3',
        'surface-container':          '#eeeeee',
        'surface-container-high':     '#e8e8e8',
        'surface-container-highest':  '#e2e2e2',

        // Text & borders
        'on-surface':                 '#323232',
        'on-surface-variant':         '#5f5f5f',
        'outline':                    '#7b7b7b',
        'outline-variant':            '#b2b2b2',

        // Status
        'error':                      '#9f403d',
        'error-container':            '#fe8983',
      },

      fontFamily: {
        // Inter statt DM Sans – gemäß Stitch Design Spec
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },

      // Stitch border-radius scale (innerhalb extend, damit rounded-full erhalten bleibt)
      borderRadius: {
        'DEFAULT': '0.125rem',  // 2px  – minimal rounding (inner elements)
        'sm':      '0.125rem',
        'md':      '0.375rem',  // 6px  – buttons
        'lg':      '0.5rem',    // 8px  – inputs, chips
        'xl':      '0.75rem',   // 12px – cards, panels
        '2xl':     '1rem',      // 16px – large containers
      },
    },
  },
  plugins: [],
}
