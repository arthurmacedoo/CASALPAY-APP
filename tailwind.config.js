/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta do casal
        bg: {
          DEFAULT: "#0D0D14",
          card: "#16161F",
          elevated: "#1E1E2C",
        },
        border: {
          DEFAULT: "#2A2A3E",
          light: "#3A3A52",
        },
        accent: {
          pink: "#E879A0",    // Rosa — usada para Namorada
          blue: "#7B8FFF",    // Azul — usada para Arthur
          purple: "#A855F7",  // Roxo — usada para Fatura Zara
          green: "#4ADE80",   // Verde — zerado
          red: "#F87171",     // Erro
        },
        text: {
          primary: "#F0F0F8",
          secondary: "#9090B0",
          muted: "#5A5A78",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.4)",
        glow: "0 0 20px rgba(232, 121, 160, 0.15)",
        "glow-blue": "0 0 20px rgba(123, 143, 255, 0.15)",
      },
    },
  },
  plugins: [],
};
