/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tuner: {
          bg: '#0f1115',
          card: '#171a21',
          accent: '#22c55e',
          warn: '#f59e0b',
          danger: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}