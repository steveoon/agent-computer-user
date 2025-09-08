import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // 首先定义要忽略的文件
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".next/**",
      "out/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "vitest.config.*",
      "vitest.setup.*",
      "coverage/**",
      ".nyc_output/**",
      "examples/**",
      "e2e/**",
      "playwright-tests/**",
      "docs/**",
      "*.md",
    ],
  },
  // 然后应用规则到其他文件
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...compat.extends("plugin:@typescript-eslint/recommended"),
  {
    rules: {
      // TypeScript 严格类型检查 - 这些是最重要的规则
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // React Hooks 严格依赖检查
      "react-hooks/exhaustive-deps": "error",

      // 基础 TypeScript 规则（不需要类型信息）
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // 通用最佳实践
      "prefer-const": "error",
      "no-var": "error",
      "no-console": "off",

      // 禁用一些可能产生噪音的规则
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;
