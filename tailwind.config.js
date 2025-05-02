/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#063a80',
          50: '#e6f0f9',
          100: '#cce0f3',
          200: '#99c2e7',
          300: '#66a3db',
          400: '#3385cf',
          500: '#0066c3',
          600: '#00529c',
          700: '#063a80',
          800: '#042759',
          900: '#021333',
        },
        accent: {
          DEFAULT: '#ff914d',
          50: '#fff5eb',
          100: '#ffebd7',
          200: '#ffd7af',
          300: '#ffc387',
          400: '#ffaf5f',
          500: '#ff914d',
          600: '#cc743e',
          700: '#995730',
          800: '#663a20',
          900: '#331d10',
        },
        success: {
          DEFAULT: '#10b981',
          light: '#d1fae5',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light: '#fef3c7',
        },
        error: {
          DEFAULT: '#ef4444',
          light: '#fee2e2',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
    },
  },
  plugins: [],
};