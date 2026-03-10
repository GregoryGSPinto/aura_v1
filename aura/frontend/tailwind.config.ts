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
        border: "rgba(212, 175, 55, 0.15)",
        background: "#0A0A0F",
        foreground: "#FFFFFF",
        gold: {
          DEFAULT: "#D4AF37",
          light: "#F4E4BC",
          dark: "#8B7355",
        },
        cyan: {
          DEFAULT: "#00D4FF",
          deep: "#0088AA",
        },
        aura: {
          base: "#0A0A0F",
          panel: "#0D1117",
          panelSoft: "#161B22",
          line: "rgba(212, 175, 55, 0.15)",
          text: "#FFFFFF",
          muted: "#8B949E",
          accent: "#D4AF37",
          glow: "#00D4FF",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        aura: "0 30px 80px rgba(3, 8, 20, 0.45)",
        glow: "0 0 30px rgba(212, 175, 55, 0.3)",
        "glow-cyan": "0 0 30px rgba(0, 212, 255, 0.3)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
        "gradient-gold": "linear-gradient(135deg, #D4AF37 0%, #F4E4BC 50%, #D4AF37 100%)",
        "gradient-cyan": "linear-gradient(180deg, #00D4FF 0%, #0088AA 100%)",
        "gradient-aura": "linear-gradient(135deg, #D4AF37 0%, #00D4FF 100%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        glow: "glow 2s ease-in-out infinite alternate",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(212, 175, 55, 0.2)" },
          "100%": { boxShadow: "0 0 40px rgba(212, 175, 55, 0.4)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
