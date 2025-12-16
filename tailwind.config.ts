import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5e6ff',
          100: '#eaccff',
          200: '#d999ff',
          300: '#c766ff',
          400: '#b433ff',
          500: '#a100ff',
          600: '#880BDB',
          700: '#6d09af',
          800: '#520783',
          900: '#370557',
        },
      },
    },
  },
  plugins: [],
}
export default config

