/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "var(--color-brand-50, #fff7ed)",
          100: "var(--color-brand-100, #ffedd5)",
          200: "var(--color-brand-200, #fed7aa)",
          300: "var(--color-brand-300, #fdba74)",
          400: "var(--color-brand-400, #fb923c)",
          500: "var(--color-brand-500, #ea580c)",
          600: "var(--color-brand-600, #c2410c)",
          700: "var(--color-brand-700, #9a3412)",
          800: "var(--color-brand-800, #7c2d12)",
          900: "var(--color-brand-900, #431407)",
        },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
