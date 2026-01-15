const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // 禁用优化以确保 dev/production 样式一致
      // 参考: https://github.com/tailwindlabs/tailwindcss/discussions/18012
      optimize: false,
    },
  },
};

export default config;
