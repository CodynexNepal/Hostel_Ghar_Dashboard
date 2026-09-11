import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#C3FF7D",
          dark: "#A8E85E",
          muted: "#EAFCCB",
          ink: "#010101",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F7F7F5",
          border: "#E8E8E6",
        },
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(1,1,1,0.06)",
        pop: "0 12px 32px rgba(1,1,1,0.12)",
      },
      borderRadius: {
        card: "10px",
      },
      transitionTimingFunction: {
        sidebar: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
