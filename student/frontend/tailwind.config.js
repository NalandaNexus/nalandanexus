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
        nexus: {
          bg: '#080C15',
          card: '#0D1424',
          surface: '#121C33',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-hover': 'rgba(255, 255, 255, 0.2)',
        },
        communicate: {
          light: '#C4B5FD',
          DEFAULT: '#8B5CF6',
          dark: '#6D28D9',
          glow: 'rgba(139, 92, 246, 0.25)',
        },
        compute: {
          light: '#67E8F9',
          DEFAULT: '#06B6D4',
          blue: '#3B82F6',
          dark: '#0284C7',
          glow: 'rgba(6, 182, 212, 0.25)',
        },
        create: {
          light: '#FDBA74',
          DEFAULT: '#F97316',
          amber: '#F59E0B',
          dark: '#C2410C',
          glow: 'rgba(249, 115, 22, 0.25)',
        },
        brand: {
          navy: '#0E3A75',
          blue: '#1E40AF',
          gold: '#F59E0B',
          charcoal: '#18181B',
          'charcoal-hover': '#27272A',
        },
        nalanda: {
          indigo: '#22355E',
          terracotta: '#AB5236',
          parchment: '#EDEAE0',
          gold: '#C99A2E',
          sage: '#5C7A5E',
          charcoal: '#2B2B28',
          card: '#F7F5EE',
          cardHover: '#F2EFE6',
          border: '#DFDACB',
          borderLight: 'rgba(34, 53, 94, 0.12)',
        },
        char: {
          purple: '#7C3AED',
          pink: '#EC4899',
          orange: '#F97316',
          yellow: '#FACC15',
        }
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        heading: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'Manrope', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Manrope', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 25px 60px -15px rgba(15, 23, 42, 0.12), 0 0 1px 1px rgba(15, 23, 42, 0.05)',
        'card-dark': '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
        'nexus-card': '0 20px 50px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.07)',
        'nexus-glow': '0 0 35px rgba(59, 130, 246, 0.15)',
        'communicate-glow': '0 0 35px rgba(139, 92, 246, 0.25)',
        'compute-glow': '0 0 35px rgba(6, 182, 212, 0.25)',
        'create-glow': '0 0 35px rgba(249, 115, 22, 0.25)',
        btn: '0 4px 14px rgba(24, 24, 27, 0.2)',
        'btn-hover': '0 6px 20px rgba(24, 24, 27, 0.3)',
      },
      borderRadius: {
        'card': '28px',
        'nexus': '20px',
        'pill': '9999px',
      },
      animation: {
        'float-slow': 'float 6s ease-in-out infinite',
        'float-medium': 'float 4.5s ease-in-out infinite',
        'float-fast': 'float 3.2s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        }
      }
    },
  },
  plugins: [],
}
