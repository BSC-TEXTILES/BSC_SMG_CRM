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
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)'
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          soft: 'var(--color-accent-soft)',
          softHover: 'var(--color-accent-soft-hover)'
        },
        background: 'var(--color-background)',
        // Keeping legacy names mapped to new colors to avoid breaking standard tailwind classes currently used
        burgundy: {
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-hover)',
          light: 'var(--color-primary-hover)',
          hover: 'var(--color-primary-hover)'
        },
        champagne: {
          DEFAULT: 'var(--color-accent)',
          dark: 'var(--color-accent-hover)',
          light: 'var(--color-accent-soft)',
          hover: 'var(--color-accent-hover)'
        },
        ivory: {
          DEFAULT: 'var(--color-background)',
          card: '#FFFFFF',
          border: 'var(--color-accent-soft)'
        },
        navy: {
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-hover)',
          light: 'var(--color-primary-hover)'
        },
        gold: {
          DEFAULT: 'var(--color-accent)',
          dark: 'var(--color-accent-hover)',
          light: 'var(--color-accent-soft)'
        },
        cream: {
          DEFAULT: 'var(--color-background)',
          bg: 'var(--color-background)'
        }
      },
      textColor: {
        primary: {
          DEFAULT: '#21181A', // Rich deep charcoal (non-blue)
          hover: '#611427'
        },
        'primary-hover': '#611427'
      }
    },
  },
  plugins: [],
};
export default config;
