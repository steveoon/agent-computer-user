# Electron + Tailwind CSS v4 样式不一致问题

## 问题描述

在 `electron dev` 模式下样式正常，但 `pnpm electron:pack` 打包后，某些 Tailwind 颜色类（如 `text-slate-400`、`divide-slate-50`）不生效，导致颜色与 dev 模式不一致。

### 具体表现

- Dev 模式：`text-slate-400` 生成 `color: var(--color-slate-400);`
- Pack 模式：`text-slate-400` 没有生成 `color` 属性，回退到父元素颜色

## 根本原因

**Tailwind CSS v4 的 PostCSS 优化** 在 production 构建时会对 CSS 进行激进的优化/压缩，导致某些样式类的生成方式与 dev 模式不同。

这是 Tailwind v4 + Next.js standalone 构建的已知问题：
- [Tailwind Nested Styles Not Work in Production](https://github.com/tailwindlabs/tailwindcss/discussions/18012)
- [Next.js Standalone CSS Issue](https://github.com/vercel/next.js/issues/59229)

## 解决方案

在 `postcss.config.mjs` 中禁用 Tailwind PostCSS 优化：

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // 禁用优化以确保 dev/production 样式一致
      optimize: false,
    },
  },
};

export default config;
```

## 注意事项

1. 禁用优化可能会略微增加 CSS 文件大小，但能确保 dev/production 样式一致
2. 如果遇到类似问题，先检查 PostCSS 配置
3. 修改后需要清理缓存并重新打包：
   ```bash
   rm -rf dist .next && pnpm electron:pack
   ```

## 排查步骤

如果再次遇到样式不一致问题：

1. 打开 DevTools，检查元素的 Computed Styles
2. 对比 dev 和 pack 模式下的 CSS 变量和属性
3. 检查是否有 CSS 变量缺失（如 `--color-slate-100`）
4. 检查是否有 CSS 属性缺失（如 `color`、`border-color`）

## 相关文件

- `postcss.config.mjs` - PostCSS 配置
- `app/globals.css` - Tailwind 主题配置
- `next.config.ts` - Next.js 配置（`output: "standalone"`）
