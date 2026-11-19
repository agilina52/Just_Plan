import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1f1c",
        paper: "#f3efe6",
        moss: "#2f5d50",
        clay: "#c46b3a",
        mist: "#d9e2dc",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Segoe UI", "sans-serif"],
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(47,93,80,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(47,93,80,0.08) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
