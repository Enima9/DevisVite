import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bleu encre : le bleu du logo, plus profond (contraste 9:1 sur blanc)
        brand: {
          DEFAULT: '#1B3A8C',
          dark: '#12286A',
          light: '#E8EDF8',
        },
        ink: '#0E1A2F',
        // Laiton : filets et accents (jamais pour du texte sur blanc)
        brass: {
          DEFAULT: '#B08840',
          light: '#E9D9B5',
          dark: '#7A5A1E',
        },
        // Plâtre : fond de page, légèrement froid
        paper: '#F1F2F4',
        // Rouge tampon : 5,4:1 sur blanc
        stamp: '#B8302A',
        slate: {
          50: '#F7F8FA',
          100: '#EFF1F4',
          200: '#E1E4EA',
          300: '#CDD2DB',
          400: '#98A1B0',
          500: '#6B7585',
          600: '#4B5565',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        sheet: '0 1px 2px rgba(14,26,47,0.06), 0 12px 32px -12px rgba(14,26,47,0.22)',
        lift: '0 1px 2px rgba(14,26,47,0.08), 0 6px 16px -6px rgba(14,26,47,0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
