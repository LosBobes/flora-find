/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Brand greens, used across the whole UI.
        forest: {
          50: '#f1f8f1',
          100: '#dcecdc',
          200: '#bcd9bd',
          300: '#8fbf92',
          400: '#5fa163',
          500: '#43a047',
          600: '#2e7d32',
          700: '#1b5e20',
          800: '#164a1a',
          900: '#0f3312',
        },
      },
      boxShadow: {
        glow: '0 8px 30px rgba(27, 94, 32, 0.18)',
        card: '0 10px 40px rgba(15, 51, 18, 0.16)',
      },
      keyframes: {
        // Magic UI: ShimmerButton
        'shimmer-slide': {
          to: { transform: 'translate(calc(100cqw - 100%), 0)' },
        },
        'spin-around': {
          '0%': { transform: 'translateZ(0) rotate(0)' },
          '15%, 35%': { transform: 'translateZ(0) rotate(90deg)' },
          '65%, 85%': { transform: 'translateZ(0) rotate(270deg)' },
          '100%': { transform: 'translateZ(0) rotate(360deg)' },
        },
        // Magic UI: AnimatedShinyText
        'shiny-text': {
          '0%, 90%, 100%': { 'background-position': 'calc(-100% - var(--shiny-width)) 0' },
          '30%, 60%': { 'background-position': 'calc(100% + var(--shiny-width)) 0' },
        },
        // A white band that sweeps across the always-visible logo, then rests.
        'logo-shine': {
          '0%': { 'background-position': '-60px 0' },
          '22%, 100%': { 'background-position': 'calc(100% + 60px) 0' },
        },
        // Marker + card entrances
        'pop-in': {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '70%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'shimmer-slide': 'shimmer-slide var(--speed) ease-in-out infinite alternate',
        'spin-around': 'spin-around calc(var(--speed) * 2) infinite linear',
        'shiny-text': 'shiny-text 8s infinite',
        'logo-shine': 'logo-shine 4.5s ease-in-out infinite',
        'pop-in': 'pop-in 0.25s ease-out both',
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
