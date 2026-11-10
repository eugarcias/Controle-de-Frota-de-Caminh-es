/** @type {import('tailwindcss').Config} */
// Paleta extraída da logo VSM Garcia: preto, verde neon (degradê lima → verde) e branco.
// A escala "sky" é remapeada para o verde da marca, de modo que todos os componentes
// que usam sky-* seguem automaticamente a identidade visual.
const brand = {
  50: '#f4ffe6',
  100: '#e4fcc4',
  200: '#c9f78e',
  300: '#a8f04a',
  400: '#8be61c',
  500: '#2fc43a',
  600: '#1f9e2e',
  700: '#17782a',
  800: '#14602a',
  900: '#0f3d1c',
  950: '#0a2a14',
};

module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: brand,
        vsm: brand,
      },
    },
  },
  plugins: [],
};
