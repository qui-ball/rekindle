/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Cozy Home palette (design-10-cozy-home.html)
        cozy: {
          background: '#faf5f0',
          surface: '#ffffff',
          text: '#5a4a3a',
          textSecondary: '#8b6f47',
          textMuted: '#8b6f47',
          heading: '#6b5b3d',
          accent: '#c9a882',
          accentDark: '#8b6f47',
          border: '#c9a882',
          borderCard: '#e8dcc6',
          mount: '#f5ede0',
          gradientBeforeStart: '#e8dcc6',
          gradientBeforeEnd: '#d4c4b0',
          gradientAfterStart: '#fff5e6',
          gradientAfterEnd: '#ffe8cc',
          gradientButtonStart: '#c9a882',
          gradientButtonEnd: '#8b6f47',
        },
        // Semantic colors (harmonize with Cozy Home, WCAG AA contrast)
        cozySemantic: {
          success: '#4a6b4a',
          successMuted: '#5a7a5a',
          error: '#8b4a3a',
          errorMuted: '#9a5a4a',
          warning: '#8b6a2a',
          warningMuted: '#9a7a3a',
          info: '#6b6b5a',
          infoMuted: '#7a7a6a',
        },
      },
      fontFamily: {
        serif: ['var(--font-merriweather)', 'Merriweather', 'Georgia', 'serif'],
      },
      fontSize: {
        'cozy-logo': ['2.8rem', { lineHeight: '1.2' }],
        'cozy-h1': ['2.8rem', { lineHeight: '1.4' }],
        'cozy-h2': ['2.5rem', { lineHeight: '1.3' }],
        'cozy-h3': ['1.4rem', { lineHeight: '1.4' }],
        'cozy-tagline': ['1.1rem', { lineHeight: '1.4' }],
        'cozy-hero': ['1.2rem', { lineHeight: '1.6' }],
        'cozy-body': ['1rem', { lineHeight: '1.8' }],
        'cozy-caption': ['0.9rem', { lineHeight: '1.5' }],
        'cozy-button': ['1.1rem', { lineHeight: '1.4' }],
      },
      lineHeight: {
        'cozy': '1.8',
      },
      maxWidth: {
        'cozy-container': '1200px',
      },
      spacing: {
        'cozy-container': '2rem',
        'cozy-container-tablet': '1.5rem',
        'cozy-container-mobile': '1rem',
        'cozy-section': '4rem',
      },
      borderRadius: {
        'cozy-lg': '15px',
        'cozy-md': '12px',
        'cozy-sm': '10px',
        'cozy-input': '8px',
        'cozy-pill': '50px',
      },
      boxShadow: {
        'cozy-card': '0 5px 20px rgba(0, 0, 0, 0.08)',
        'cozy-card-hover': '0 8px 25px rgba(0, 0, 0, 0.12)',
        'cozy-button': '0 5px 20px rgba(201, 168, 130, 0.3)',
        'cozy-button-hover': '0 8px 25px rgba(201, 168, 130, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      screens: {
        'xs': '475px',
        'cozy-mobile': '480px',
        'cozy-tablet': '768px',
      },
    },
  },
  plugins: [],
};