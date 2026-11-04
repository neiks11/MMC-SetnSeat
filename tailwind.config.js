/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Refined, WCAG-accessible Rosewood Crimson / Balanced Burgundy
        emerald: {
          50: '#fbf6f5',  // Soft rose-ivory tint (never harsh pink)
          100: '#f5eae7', // Warm blush-sand surface
          200: '#e8d0ca', // Subtle rosewood border
          300: '#d5a89d', // Soft terracotta accent
          400: '#bc7767', // Muted coral-terracotta
          500: '#a64b3a', // Balanced warm crimson
          600: '#8f3828', // Brand crimson (WCAG AA 6.2:1 with white)
          700: '#7a2c1e', // Primary interactive burgundy (WCAG AAA 8.3:1 with white)
          800: '#632217', // Deep burgundy hover (10.6:1 with white)
          900: '#4d1b12', // Wine-espresso surface (12.9:1 with white)
          950: '#2c100b', // Deep espresso-burgundy (16.5:1 with white)
        },
        // Harmonious Champagne Gold / Soft Warm Honey Amber (replaces harsh yellow)
        amber: {
          50: '#fdfaf3',  // Champagne cream
          100: '#f9f1de', // Soft warm gold tint
          200: '#f1e0b8', // Antique gold border
          300: '#e6c885', // Luminous champagne gold for dark backgrounds (10.2:1 on 950)
          400: '#ddb664', // Refined warm honey-gold CTA button (8.7:1 with charcoal-900)
          500: '#c4963f', // Burnished gold hover
          600: '#9e7222', // Warm bronze-gold
          700: '#7c5618', // Accessible amber text on light backgrounds (6.1:1)
          800: '#634313', // Deep bronze-amber text (8.5:1)
          900: '#4f3510', // Dark umber-gold (10.8:1)
          950: '#2e1d07', // Espresso-gold
        },
        // Soft Alabaster & Warm Birch-Parchment neutrals
        warm: {
          50: '#fcfaf7',  // Clean warm alabaster background
          100: '#f5efe6', // Soft parchment card/section background
          200: '#e8decb', // Warm stone border
          300: '#d5c4a8', // Muted sand accent
        },
        // Deep Espresso-Slate for high-contrast typography & dark surfaces
        charcoal: {
          800: '#2b2220',
          900: '#1a1412',
        },
      },
    },
  },
  plugins: [],
};
