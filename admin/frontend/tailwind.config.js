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
        // Brand Institutional Palette
        brand: {
          indigo: '#22355E',      // ink-indigo (Sidebar, headings, structure)
          terracotta: '#AB5236',  // brick-terracotta (Primary CTA buttons only)
          parchment: '#EDEAE0',   // parchment (Main page background)
          charcoal: '#2B2B28',    // charcoal-ink (Body typography)
        },
        // Functional Status Palette (Strictly isolated from brand decoration)
        status: {
          good: '#5C7A5E',        // Active, Healthy, Positive trend, Completed
          attention: '#C99A2E',   // Pending, Invited, Needs review, Expiring soon
          blocked: '#C1352B',     // Suspended, Failed, Critical, Negative trend
          neutral: '#9B9690',     // Inactive, Archived, No action required
        },
        // Parchment card & surface elevations
        card: {
          base: '#F7F5EE',
          hover: '#F2EFE6',
          white: '#FFFFFF',
          border: '#DFDACB',
          subtle: 'rgba(34, 53, 94, 0.08)',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Inter', 'Manrope', '"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'Manrope', '"Plus Jakarta Sans"', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(34, 53, 94, 0.05), 0 1px 2px rgba(34, 53, 94, 0.03)',
        card: '0 4px 16px -2px rgba(34, 53, 94, 0.06), 0 2px 6px -1px rgba(34, 53, 94, 0.04)',
        hover: '0 8px 24px -4px rgba(34, 53, 94, 0.10), 0 4px 12px -2px rgba(34, 53, 94, 0.06)',
        dropdown: '0 12px 32px -4px rgba(34, 53, 94, 0.14), 0 4px 12px -2px rgba(34, 53, 94, 0.08)',
        cta: '0 4px 14px rgba(171, 82, 54, 0.28)',
      },
      borderRadius: {
        card: '14px',
        interactive: '10px',
      },
    },
  },
  plugins: [],
}
