import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xs: '420px',      // small phones — used by Topbar for the location strip
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    extend: {
      colors: {
        burgundy: {
          DEFAULT: '#163B5C',
          dark: '#0E2A44',
          light: '#1F4D77',
          hover: '#27476E'
        },
        champagne: {
          DEFAULT: '#4E8ABF',
          dark: '#3D74A3',
          light: '#6FA3D0',
          hover: '#3D74A3'
        },
        ivory: {
          DEFAULT: '#F4F6F9',
          card: '#FFFFFF',
          border: '#DFE6EE'
        },
        // Legacy aliases (burgundy/champagne keys kept for compatibility; values are the corporate slate-blue theme)
        navy: {
          DEFAULT: '#163B5C',
          dark: '#0E2A44',
          light: '#1F4D77'
        },
        gold: {
          DEFAULT: '#4E8ABF',
          dark: '#3D74A3',
          light: '#6FA3D0'
        },
        cream: {
          DEFAULT: '#F4F6F9',
          bg: '#F4F6F9'
        }
      }
    },
  },
  plugins: [],
};
export default config;
