/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dce8ff",
          200: "#b8d1ff",
          300: "#8bb3ff",
          400: "#5c8dff",
          500: "#3366ff",
          600: "#254cdb",
          700: "#1c3bb0",
          800: "#182f8a",
          900: "#152a6e",
        },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
