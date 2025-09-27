/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#0f172a',
        },
      },
      boxShadow: {
        focus: '0 0 0 3px rgba(56, 189, 248, 0.45)',
      },
    },
  },
  plugins: [],
}
