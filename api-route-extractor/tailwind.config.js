/**** Tailwind configuration for the API Route Extractor app ****/

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#1a1a2e',
        'brand-surface': '#162447',
        'brand-primary': '#1f4068',
        'brand-secondary': '#e43f5a',
        'brand-text': '#dcdcdc',
        'brand-subtle': '#a9a9a9',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
