import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        sidebar: {
          DEFAULT: "#ffffff",
          foreground: "#1e293b",
          primary: "#16a34a",
          "primary-foreground": "#ffffff",
          accent: "#f1f5f9",
          "accent-foreground": "#0f172a",
          border: "#e2e8f0",
          ring: "#16a34a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
