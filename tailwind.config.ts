import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#eef2f9", // page
        panel: "#ffffff", // cards
        panel2: "#f4f7fc", // insets / inputs
        edge: "#e4e9f2", // borders
        fg: "#16213e", // text
        muted: "#6b7689", // secondary text
        accent: "#6d4bff", // primary (purple)
        accent2: "#4f7df0", // secondary (blue)
        good: "#15a35b",
        warn: "#c77700",
        bad: "#e0476a",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
