const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // Electron 构建时禁用优化以确保 dev/production 样式一致
      // Web 构建时保持优化以减小 CSS 体积
      // 参考: https://github.com/tailwindlabs/tailwindcss/discussions/18012
      optimize: process.env.ELECTRON_BUILD !== "true",
    },
  },
};

export default config;
