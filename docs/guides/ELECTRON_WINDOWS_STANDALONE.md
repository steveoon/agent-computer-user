# Electron + pnpm + Windows Standalone 构建问题

## 问题描述

在 Windows 上使用 pnpm + Next.js standalone 模式构建 Electron 应用时，运行时报错找不到模块：

```
Error: Cannot find module 'styled-jsx/package.json'
Error: Cannot find module '@swc/helpers/_/_interop_require_default'
```

### 环境条件

- 包管理器：pnpm（isolated 模式，非 hoisted）
- Next.js 配置：`output: "standalone"`
- 构建平台：Windows（GitHub Actions windows-2022）

## 根本原因

**pnpm isolated 模式与 Next.js standalone 的兼容性问题**

1. **pnpm 的依赖结构**：pnpm 使用 `.pnpm` 目录 + 符号链接管理依赖，间接依赖（如 `styled-jsx`、`@swc/helpers`）不在顶层 `node_modules/`
2. **Next.js standalone**：使用 `@vercel/nft` 文件追踪，在 pnpm 项目中可能无法正确追踪所有依赖
3. **Windows 符号链接**：Windows 对符号链接有权限限制，需要 `dereference: true` 转换为实际文件

### 为什么 macOS 没问题

- macOS 构建时 `resolve-standalone.js` 跳过执行（`process.platform !== "win32"`）
- 符号链接保持不变，pnpm 的嵌套结构能正确解析依赖

## 解决方案

### 方案一：`outputFileTracingIncludes`（构建阶段）

在 `next.config.ts` 中强制包含缺失的依赖：

```typescript
const isElectronBuild = process.env.ELECTRON_BUILD === "true";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(isElectronBuild
    ? {
        outputFileTracingIncludes: {
          "/*": [
            // 使用精确路径，避免扫描整个 .pnpm 导致内存溢出
            "./node_modules/.pnpm/styled-jsx@*/node_modules/styled-jsx/**/*",
            "./node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**/*",
            "./node_modules/.pnpm/client-only@*/node_modules/client-only/**/*",
            "./node_modules/.pnpm/server-only@*/node_modules/server-only/**/*",
          ],
        },
      }
    : {}),
};
```

**注意**：
- glob 模式要精确，`**/styled-jsx/**/*` 会扫描整个 `.pnpm` 目录导致内存溢出！
- `outputFileTracingIncludes` 可能将文件复制到 `.pnpm/` 嵌套结构而非顶层 `node_modules/`，导致 Node.js 无法解析
- 建议同时配合 `resolve-standalone.js` 作为兜底方案

### 方案二：`resolve-standalone.js`（运行时兜底）

在 `scripts/resolve-standalone.js` 中检测并复制缺失的包：

```javascript
const requiredPackages = ["styled-jsx", "@swc/helpers", "client-only", "server-only"];

for (const pkg of requiredPackages) {
  // 检查 standalone 中是否存在
  if (exists(path.join(standaloneNodeModules, pkg, "package.json"))) {
    continue;
  }

  // 查找源路径（通过 next 的位置解析间接依赖）
  let srcPkgDir;
  try {
    const nextPkgPath = require.resolve("next/package.json", { paths: [projectRoot] });
    const nextDir = path.dirname(nextPkgPath);
    const resolvedPkgJson = require.resolve(`${pkg}/package.json`, { paths: [nextDir] });
    srcPkgDir = path.dirname(resolvedPkgJson);
  } catch {
    console.error(`Missing dependency: ${pkg}`);
    process.exit(1);
  }

  // 复制到 standalone
  fs.cpSync(srcPkgDir, destPkgDir, { recursive: true, dereference: true });
}
```

**关键点**：
- `require.resolve()` 直接解析会失败（因为不是直接依赖）
- 需要通过 `next` 的路径来解析这些间接依赖
- 对于有 `exports` 限制的包（如 `client-only`），需要通过入口文件向上查找 `package.json`

### 处理 exports 限制的包

某些包（如 `client-only`、`server-only`）的 `package.json` 中有 `exports` 字段，阻止直接访问 `package.json`：

```javascript
// ❌ 失败：exports 限制阻止访问
require.resolve("client-only/package.json");

// ✅ 成功：通过入口文件解析
const entryPath = require.resolve("client-only");
// 然后向上遍历目录找到 package.json
```

`resolve-standalone.js` 中的 `findPackageRootFromEntry` 函数专门处理这种情况：

```javascript
function findPackageRootFromEntry(entryPath, pkgName) {
  let dir = path.dirname(entryPath);
  while (dir && dir !== path.dirname(dir)) {
    const pkgJson = path.join(dir, "package.json");
    if (exists(pkgJson)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf-8"));
      if (pkg.name === pkgName) return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}
```

### 方案三：增加 CI 内存限制

在 `.github/workflows/build-windows.yml` 中：

```yaml
- name: Build Electron app
  run: pnpm electron:build
  env:
    NODE_OPTIONS: --max-old-space-size=8192
```

GitHub Actions Windows runner 规格：
- 公共仓库：4 vCPU / 16 GB RAM
- 私有仓库：2 vCPU / 8 GB RAM

### 方案四：构建后验证（推荐）

在 `electron:build` 后运行 `verify-standalone.js`，通过实际 `require` 来检测缺失依赖：

```javascript
// scripts/verify-standalone.js
const standaloneDir = path.resolve(".next/standalone");

const entriesToVerify = [
  "next/dist/server/next",
  "next/dist/server/config",
  "styled-jsx/style",
  "@swc/helpers/_/_interop_require_default",
  "@next/env",
  "client-only",
  "server-only",
  "react-dom/server.browser",
  "detect-libc",
];

for (const entry of entriesToVerify) {
  try {
    // ⚠️ 必须指定 paths 选项！
    require.resolve(entry, { paths: [standaloneDir] });
    console.log(`✅ ${entry}`);
  } catch (e) {
    console.log(`❌ ${entry} - ${e.message}`);
    process.exit(1);
  }
}
```

**关键点**：
- **必须使用 `{ paths: [standaloneDir] }`**：`require.resolve()` 默认从脚本位置解析，不是从 `process.cwd()` 解析
- `process.chdir()` 和 `Module._initPaths()` 对 `require.resolve()` 无效

**优点**：
- 能捕获条件分支、动态 require、间接依赖等静态分析无法覆盖的情况
- CI 构建阶段 fail fast，不用等到运行时才发现问题

## 相关链接

- [GitHub Issue #48017 - Missing dependencies with pnpm 8](https://github.com/vercel/next.js/issues/48017)
- [GitHub Issue #50803 - Windows + pnpm standalone](https://github.com/vercel/next.js/issues/50803)
- [GitHub Discussion #66327 - Force include dependencies](https://github.com/vercel/next.js/discussions/66327)

## 相关文件

- `next.config.ts` - `outputFileTracingIncludes` 配置
- `scripts/resolve-standalone.js` - Windows standalone 后处理脚本（复制缺失包）
- `scripts/verify-standalone.js` - 构建后验证脚本（检测缺失依赖）
- `.github/workflows/build-windows.yml` - Windows CI 构建配置
- `.npmrc` - pnpm 配置（`node-linker` 设置）

## 为什么不用 `node-linker=hoisted`

`.npmrc` 中可以设置 `node-linker=hoisted` 让 pnpm 使用扁平化结构，但这会破坏 Electron 的模块解析：

```ini
# .npmrc
# 不要使用！会导致 require('electron') 返回 undefined
# node-linker=hoisted
```
