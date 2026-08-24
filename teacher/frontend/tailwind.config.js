/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand Institutional Palette (Identical to Admin Dashboard)
        brand: {
          indigo: '#22355E',      // ink-indigo (Sidebar, headings, structure, primary)
          terracotta: '#AB5236',  // brick-terracotta (CTAs / buttons only)
          'terracotta-hover': '#94452C',
          parchment: '#EDEAE0',   // parchment (Main page background)
          charcoal: '#2B2B28',    // charcoal-ink (Body typography)
          'charcoal-muted': '#6E6A64',
        },
        // Functional Status Palette (State only, never decorative)
        status: {
          good: '#5C7A5E',        // On-track, active, positive trend
          attention: '#C99A2E',   // Needs review, pending, watch
          blocked: '#C1352B',     // At-risk, suspended, negative trend, act-now
          neutral: '#9B9690',     // Inactive, no action needed
        },
        // Card & Surface Elevations (Identical to Admin Dashboard)
        card: {
          base: '#F7F5EE',
          hover: '#F2EFE6',
          white: '#FFFFFF',
          border: '#DFDACB',
          subtle: 'rgba(34, 53, 94, 0.08)',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'Manrope', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Inter', 'Manrope', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(34, 53, 94, 0.05), 0 1px 2px rgba(34, 53, 94, 0.03)',
        card: '0 4px 16px -2px rgba(34, 53, 94, 0.06), 0 2px 6px -1px rgba(34, 53, 94, 0.04)',
        hover: '0 8px 24px -4px rgba(34, 53, 94, 0.10), 0 4px 12px -2px rgba(34, 53, 94, 0.06)',
        dropdown: '0 12px 32px -4px rgba(34, 53, 94, 0.14), 0 4px 12px -2px rgba(34, 53, 94, 0.08)',
        cta: '0 4px 14px rgba(171, 82, 54, 0.28)',
        // Soft shadow only on attention/risk elements
        attention: '0 4px 14px rgba(201, 154, 46, 0.18)',
        danger: '0 4px 14px rgba(193, 53, 43, 0.18)',
      },
      borderRadius: {
        card: '14px',
        interactive: '10px',
      },
    },
  },
  plugins: [],
}
