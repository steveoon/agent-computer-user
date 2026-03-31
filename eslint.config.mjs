import nextConfig from "eslint-config-next";

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
      // Drizzle 自动生成的迁移文件
      "drizzle/**",
    ],
  },
  // Next.js 16 flat config (includes React, TypeScript, core-web-vitals)
  ...nextConfig,
  // TypeScript 文件规则覆盖
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // TypeScript 严格类型检查
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
  // 通用规则覆盖
  {
    rules: {
      // React Hooks 严格依赖检查
      "react-hooks/exhaustive-deps": "error",

      // 通用最佳实践
      "prefer-const": "error",
      "no-var": "error",
      "no-console": "off",

      // 禁用噪音规则
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;
