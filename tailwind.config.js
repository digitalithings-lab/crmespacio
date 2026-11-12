/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: { brand: { 50:'#fbf1f3',100:'#f5dde2',200:'#ebbcc6',500:'#a93d55',600:'#8a2740',700:'#6d1423',800:'#5a1020',900:'#3d0a14' } },
      keyframes: {
        'fade-up':  { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in':  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' }, '100%': { opacity: '1', transform: 'scale(1) translateY(0)' } },
        'slide-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
      },
      animation: {
        'fade-up':  'fade-up 0.4s ease-out both',
        'fade-in':  'fade-in 0.2s ease-out both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
