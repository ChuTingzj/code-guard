/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F766E',
          dark: '#115E59',
          light: '#14B8A6',
        },
        ink: {
          DEFAULT: '#0F172A',
          muted: '#64748B',
        },
        paper: '#F8FAFC',
        surface: '#FFFFFF',
        border: '#E2E8F0',
        ring: '#0F766E',
        passed: '#15803D',
        warning: '#B45309',
        rejected: '#B91C1C',
      },
      borderRadius: {
        control: '6px',
        card: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04)',
      },
      fontFamily: {
        display: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionDuration: {
        ui: '180ms',
      },
    },
  },
  plugins: [],
};
