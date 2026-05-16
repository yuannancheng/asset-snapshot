/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#162018",
        moss: "#48634f",
        mint: "#dff3e5",
        coral: "#f47d6b",
        gold: "#d4a017",
      },
      boxShadow: {
        panel: "0 18px 50px rgba(22, 32, 24, 0.08)",
      },
    },
  },
  plugins: [],
};
