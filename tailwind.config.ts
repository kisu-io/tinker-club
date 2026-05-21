import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0f172a",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        // Action red, used sparingly for primary CTAs only. See design-system/MASTER.md.
        accent: {
          DEFAULT: "#dc2626",
          50: "#fef2f2",
          100: "#fee2e2",
          600: "#dc2626",
          700: "#b91c1c",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.06)",
        // Lifted hover shadow for editorial cards.
        lift: "0 12px 32px -8px rgba(15,23,42,0.18), 0 4px 12px -4px rgba(15,23,42,0.10)",
      },
      letterSpacing: {
        eyebrow: "0.18em",
      },
      transitionDuration: {
        "600": "600ms",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        // Entrance for collection cards. `forwards` keeps the end state.
        rise: "rise 360ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
