/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "rgb(var(--color-app) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        subtle: "rgb(var(--color-subtle) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        moss: "rgb(var(--color-moss) / <alpha-value>)",
        mint: "rgb(var(--color-mint) / <alpha-value>)",
        coral: "rgb(var(--color-coral) / <alpha-value>)",
        gold: "rgb(var(--color-gold) / <alpha-value>)",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
      },
    },
  },
  plugins: [],
};
