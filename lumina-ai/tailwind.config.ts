import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#007AFF",
          secondary: "#FF9500",
          light: "#E5F2FF",
        },
        surface: {
          light: "#FFFFFF",
          lightAlt: "#F5F5F7",
          dark: "#1C1C1E",
          darkAlt: "#1E293B",
        },
        text: {
          primary: "#1D1D1F",
          secondary: "#86868B",
          tertiary: "#AEAEB2",
        },
        semantic: {
          success: "#30D158",
          error: "#FF3B30",
          warning: "#FFCC00",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Inter",
          "PingFang SC",
          "Noto Sans SC",
          "sans-serif",
        ],
      },
      fontSize: {
        hero: ["64px", { lineHeight: "1.3", fontWeight: "600" }],
        h1: ["40px", { lineHeight: "1.3", fontWeight: "600" }],
        h2: ["28px", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["20px", { lineHeight: "1.3", fontWeight: "500" }],
        body: ["17px", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["15px", { lineHeight: "1.5", fontWeight: "400" }],
      },
      borderRadius: {
        apple: "12px",
        card: "16px",
        image: "20px",
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
      },
      boxShadow: {
        card: "0 4px 20px rgba(0,0,0,0.06)",
        "card-hover": "0 8px 32px rgba(0,0,0,0.10)",
      },
      maxWidth: {
        desktop: "1440px",
      },
      transitionTimingFunction: {
        "apple-spring":
          "cubic-bezier(0.25, 0.1, 0.0, 0.98)",
      },
    },
  },
  plugins: [],
};

export default config;
