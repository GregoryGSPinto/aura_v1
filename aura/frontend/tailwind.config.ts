import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          base: "#0b1020",
          panel: "#121a31",
          panelSoft: "#192445",
          line: "rgba(255,255,255,0.08)",
          text: "#f4f7fb",
          muted: "#9ea9c7",
          accent: "#72e0a6",
          accentSoft: "#68cde7",
          glow: "#ffe082"
        }
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "sans-serif"],
        display: ["var(--font-space-grotesk)", "sans-serif"]
      },
      boxShadow: {
        aura: "0 30px 80px rgba(3, 8, 20, 0.45)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)"
      }
    },
  },
  plugins: [],
} satisfies Config;

