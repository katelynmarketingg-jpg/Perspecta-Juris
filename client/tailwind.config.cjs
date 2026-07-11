const path = require('path')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'src/**/*.{js,jsx,ts,tsx}'),
    path.join(__dirname, 'index.html'),
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand: laranja mais fechado (orange-700 como primário)
        brand: {
          50:  '#fff4ed',
          100: '#ffe6d5',
          200: '#ffc9a8',
          300: '#ffa070',
          400: '#fd6c37',
          500: '#c2410c',   // PRIMARY — laranja escuro
          600: '#9a3412',   // hover
          700: '#7c2d12',   // active
          800: '#4a1a09',
          900: '#2c0f05',
          950: '#180800',
        },
        // Accent: laranja vivo para texto/ícones em fundo escuro
        accent: {
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
        },
        surface: {
          900: '#060606',
          800: '#0a0a0a',
          700: '#111111',
          600: '#1a1a1a',
          500: '#222222',
          400: '#2a2a2a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.6), 0 1px 2px -1px rgb(0 0 0 / 0.4)',
        'card-hover': '0 4px 16px 0 rgb(0 0 0 / 0.5)',
        modal: '0 25px 80px -10px rgb(0 0 0 / 0.8)',
        orange: '0 4px 14px 0 rgb(194 65 12 / 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
