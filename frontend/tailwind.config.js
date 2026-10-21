/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2f48e1",
        "primary-dark": "#1e35b8",
        "primary-light": "#A18E7C",
        "primary-orange": "#EE7542",
        "disabled-bg": "#FCE3D9",
        "disabled-text": "#FBDDD0",
        "primary-brown": "#A18E7C",
        "gray-1": "#F6F7FE",
        "gray-2": "#EBEDF8",
        "gray-3": "#C0C5DC",
        "gray-4": "#7F85A3",
        "gray-5": "#484A64",
        "gray-6": "#2A2A3A",
        "state-normal": "#50D192",
        "state-mild": "#FCDB65",
        "state-caution": "#FFA36E",
        "state-severe": "#F87563",
        good: "#50D192",
        soso: "#FCDB65",
        worst: "#F87563",
      },
      fontFamily: {
        sans: ["Noto Sans KR", "Pretendard", "sans-serif"],
      },
    },
  },
  plugins: [],
};
