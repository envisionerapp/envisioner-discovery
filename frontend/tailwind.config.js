/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        '2xl': '1430px',
      },
      colors: {
        primary: {
          50: '#fffbea',
          100: '#fff3c4',
          200: '#ffe58f',
          300: '#ffd75a',
          400: '#ffcb26',
          500: '#fdc600',
          600: '#e0b200',
          700: '#b98f00',
          800: '#8f6e00',
          900: '#6b5300',
          950: '#4a3900',
        },
        accent: '#646881',
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#080708',
        },
      },
      fontFamily: {
        sans: ['Oxanium', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
