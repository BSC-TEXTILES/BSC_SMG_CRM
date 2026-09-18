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
        // Literal hex values (NOT var()) so Tailwind can correctly compile
        // alpha utilities such as bg-accent/10, text-white/80, border-accent/25.
        // (var() strings made Tailwind emit `rgb(var(--x) / a)` which is invalid
        // CSS and was silently dropped, killing those styles entirely.)
        primary: {
          DEFAULT: '#6B1F2A',
          hover: '#551829',
          light: '#8B2E3A',
          soft: '#F5ECEC'
        },
        accent: {
          DEFAULT: '#C9A227',
          hover: '#A8881F',
          soft: '#FBF5E1',
          softHover: '#F5EBCC'
        },
        background: '#F7F3EF',
        // Keeping legacy names mapped to new colors to avoid breaking standard tailwind classes currently used
        burgundy: {
          DEFAULT: '#6B1F2A',
          dark: '#551829',
          light: '#8B2E3A',
          hover: '#551829'
        },
        champagne: {
          DEFAULT: '#C9A227',
          dark: '#A8881F',
          light: '#FBF5E1',
          hover: '#A8881F'
        },
        ivory: {
          DEFAULT: '#F7F3EF',
          card: '#FFFFFF',
          border: '#F5ECEC'
        },
      },
      textColor: {
        primary: {
          DEFAULT: '#2C1A1D',
          hover: '#1A0F11'
        },
        'primary-hover': '#1A0F11'
      }
    },
  },
  plugins: [],
};
export default config;
