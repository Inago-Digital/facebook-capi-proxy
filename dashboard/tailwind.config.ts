export default {
  content: ["./src/**/*.{ts,tsx,jsx,md}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0c0e",
        surface: "#111418",
        surfaceAlt: "#181c22",
        border: "#252a32",
        borderStrong: "#2e3540",
        text: "#c8d0db",
        textDim: "#5a6472",
        textMute: "#353d48",
        accent: "#1877f2",
        accentDim: "#0f4a9e",
        success: "#22c55e",
        successDim: "#14532d",
        danger: "#ef4444",
        dangerDim: "#450a0a",
        warning: "#f59e0b",
        warningDim: "#451a03",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      boxShadow: {
        panel: "0 24px 64px rgba(0, 0, 0, 0.6)",
        toast: "0 8px 24px rgba(0, 0, 0, 0.4)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        modalIn: {
          from: {
            opacity: "0",
            transform: "scale(0.96) translateY(8px)",
          },
          to: {
            opacity: "1",
            transform: "none",
          },
        },
        toastIn: {
          from: {
            opacity: "0",
            transform: "translateX(16px)",
          },
          to: {
            opacity: "1",
            transform: "none",
          },
        },
      },
      animation: {
        pulseDot: "pulseDot 2s ease-in-out infinite",
        modalIn: "modalIn 0.18s ease-out",
        toastIn: "toastIn 0.2s ease-out",
      },
    },
  },
  plugins: [],
}
