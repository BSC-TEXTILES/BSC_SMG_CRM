import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        burgundy: {
          DEFAULT: '#4A1726',
          dark: '#350E1A',
          light: '#5C1D30',
          hover: '#551A2C'
        },
        champagne: {
          DEFAULT: '#C6A15B',
          dark: '#B5914B',
          light: '#D4B373',
          hover: '#B5914B'
        },
        ivory: {
          DEFAULT: '#F8F5F1',
          card: '#FFFFFF',
          border: '#EAE4DC'
        },
        // Legacy aliases mapped to new Burgundy/Champagne theme
        navy: {
          DEFAULT: '#4A1726',
          dark: '#350E1A',
          light: '#5C1D30'
        },
        gold: {
          DEFAULT: '#C6A15B',
          dark: '#B5914B',
          light: '#D4B373'
        },
        cream: {
          DEFAULT: '#F8F5F1',
          bg: '#F8F5F1'
        }
      }
    },
  },
  plugins: [],
};
export default config;
