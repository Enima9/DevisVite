import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bleu stylo (encre de devis) : 7,1:1 sur blanc
        brand: {
          DEFAULT: '#1F4FBF',
          dark: '#173A8F',
        },
        ink: '#1B2430',
        paper: '#EEF0F3',
        // Rouge tampon : 5,4:1 sur blanc
        stamp: '#C8372D',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // Angles nets, comme un document imprimé (remplace les gros arrondis)
      borderRadius: {
        xl: '0.375rem',
        '2xl': '0.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
