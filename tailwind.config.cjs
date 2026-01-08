/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./pages/**/*.{html,js}",
    "./src/**/*.{js,html}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#8B5CF6",
        "primary-hover": "#7C3AED",
        "secondary": "#EC4899",
        "paper": "#FFFBEB",
        "paper-white": "#ffffff",
        "paper-cream": "#fefce8",
        "paper-dark": "#2d3748",
        "ink": "#374151",
        "ink-main": "#334155",
        "ink-light": "#6B7280",
        "ink-dark": "#1e293b",
        "desk": "#e0f2fe",
        "fun-blue": "#3b82f6",
        "fun-blue-light": "#bfdbfe",
        "fun-yellow": "#fbbf24",
        "fun-orange": "#f97316",
        "fun-green": "#4ade80",
        "fun-purple": "#a855f7",
        "toy-blue": "#38BDF8",
        "toy-green": "#4ADE80",
        "toy-yellow": "#FBBF24",
        "toy-red": "#FB7185",
        "cover": "#0D9488",
      },
      fontFamily: {
        "display": ["Nunito", "sans-serif"],
        "body": ["Lexend", "sans-serif"],
        "hand": ["Comic Neue", "cursive"],
        "sans": ["Nunito", "sans-serif"],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '3rem',
      },
      backgroundImage: {
        'dot-pattern': "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2399f6e4' fill-opacity='0.6' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='2'/%3E%3Ccircle cx='13' cy='13' r='2'/%3E%3C/g%3E%3C/svg%3E\")",
        'doodle-pattern': "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='0.1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'book': '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.02)',
        'book-outer': '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        'page-depth': 'inset 0 0 20px rgba(0,0,0,0.05)',
        'input': '0 2px 0 0 #e2e8f0',
        'button': '0 4px 0 0 #0284c7',
        'button-active': '0 0 0 0 #0284c7',
        'page-left': 'inset -20px 0 30px rgba(0,0,0,0.03)',
        'page-right': 'inset 20px 0 30px rgba(0,0,0,0.03)',
        'btn-press': '0 6px 0 0',
        'sticker': '3px 3px 0px rgba(0,0,0,0.1)',
        'float': '0 10px 30px -10px rgba(139, 92, 246, 0.4)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 3s infinite',
        'wiggle-slow': 'wiggle 3s ease-in-out infinite',
        'wiggle': 'wiggle 2s ease-in-out infinite',
        'blink': 'blink 4s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        blink: {
          '0%, 90%, 100%': { transform: 'scaleY(1)' },
          '95%': { transform: 'scaleY(0.1)' },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}