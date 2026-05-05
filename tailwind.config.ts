import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'br-yellow': '#FFD700',
        'br-green': '#009B3A',
        'br-blue': '#1565C0',
        'br-dark': '#0A0718',
        'br-dark2': '#130F2A',
        'br-purple': '#1A1530',
      },
      animation: {
        'fade-in-up':    'fadeInUp 0.8s ease forwards',
        'slide-in-right':'slideInRight 0.9s ease forwards',
        'slide-in-left': 'slideInLeft 0.8s ease forwards',
        'scale-in':      'scaleIn 0.7s ease forwards',
        'float':         'float 5s ease-in-out infinite',
        'glow-pulse':    'glowPulse 3s ease-in-out infinite',
        'border-glow':   'borderGlow 2.5s ease-in-out infinite',
        'scroll-left':   'scrollLeft 30s linear infinite',
        'scroll-right':  'scrollRight 30s linear infinite',
        'float-up':      'floatUp 7s ease-in infinite',
        'shimmer':       'shimmer 2.2s linear infinite',
        'gradient-x':    'gradientX 5s ease infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(60px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-60px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.88)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-18px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1.05)' },
          '50%':      { opacity: '0.8', transform: 'scale(1.25)' },
        },
        borderGlow: {
          '0%, 100%': { boxShadow: '0 0 12px rgba(255,215,0,0.2), inset 0 0 8px rgba(255,215,0,0.05)' },
          '50%':      { boxShadow: '0 0 35px rgba(255,215,0,0.55), inset 0 0 18px rgba(255,215,0,0.12)' },
        },
        scrollLeft: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        scrollRight: {
          '0%':   { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        floatUp: {
          '0%':   { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '15%':  { opacity: '1' },
          '85%':  { opacity: '1' },
          '100%': { transform: 'translateY(-100vh) translateX(10px)', opacity: '0' },
        },
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
}

export default config
