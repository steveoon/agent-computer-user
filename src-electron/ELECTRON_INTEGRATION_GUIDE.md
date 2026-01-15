# Electron + Next.js 集成踩坑指南

本文档记录了将 Next.js 15 项目集成到 Electron 时遇到的主要问题及解决方案。

## 目录

1. [pnpm v10 构建脚本安全机制](#1-pnpm-v10-构建脚本安全机制)
2. [pnpm hoisted 模式与 Electron 冲突](#2-pnpm-hoisted-模式与-electron-冲突)
3. [ELECTRON_RUN_AS_NODE 环境变量](#3-electron_run_as_node-环境变量)
4. [NODE_ENV 环境变量](#4-node_env-环境变量)
5. [Electron API 初始化时机](#5-electron-api-初始化时机)
6. [next-electron-rsc 配置](#6-next-electron-rsc-配置)
7. [macOS Gatekeeper / Quarantine 属性](#7-macos-gatekeeper--quarantine-属性)
8. [Next.js standalone 静态资源缺失](#8-nextjs-standalone-静态资源缺失)

---

## 1. pnpm v10 构建脚本安全机制

### 问题描述

pnpm v10 默认禁用依赖包的 `postinstall` 脚本，这会导致 Electron 无法下载二进制文件：

```
╭ Warning ─────────────────────────────────────────────────────────────────────╮
│   Ignored build scripts: electron, esbuild, sharp, puppeteer.                │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed     │
│   to run scripts.                                                            │
╰──────────────────────────────────────────────────────────────────────────────╯
```

### 解决方案

在 `package.json` 中添加 `pnpm.onlyBuiltDependencies` 配置：

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["electron", "esbuild", "sharp", "puppeteer"]
  }
}
```

### 参考链接

- [pnpm v10 安全变更](https://socket.dev/blog/pnpm-10-0-0-blocks-lifecycle-scripts-by-default)
- [pnpm approve-builds](https://pnpm.io/cli/approve-builds)

---

## 2. pnpm hoisted 模式与 Electron 冲突

### 问题描述

Electron 官方文档建议使用 `node-linker=hoisted` 配置：

> 使用常规的 node_modules 文件夹安装依赖项。Electron 的打包工具链要求 node_modules 文件夹必须像 npm 安装那样物理存在于磁盘上。

但实际测试发现，使用 hoisted 模式会导致 `require('electron')` 返回 `undefined`：

```javascript
const { app, BrowserWindow } = require("electron");
console.log(app); // undefined!
console.log(BrowserWindow); // undefined!
```

### 原因分析

当使用 hoisted 模式时，Node.js 的模块解析会优先找到 `node_modules/electron/index.js`（npm 包），而不是 Electron 内置的 `electron` 模块。npm 包的 `index.js` 只导出 Electron 可执行文件的路径字符串，而非 API 对象。

### 解决方案

**不使用 hoisted 模式**，保持 pnpm 默认的 symlink 结构：

```ini
# .npmrc
# 注意：不要设置 node-linker=hoisted
# 这会破坏 Electron 的模块解析

# Enable build scripts for Electron and related packages
enable-pre-post-scripts=true
```

### 对 electron-builder 的影响

不使用 hoisted 模式可能会影响 electron-builder 打包。如果遇到问题，可以考虑：

1. 打包前手动处理 node_modules 结构
2. 使用 `electron-builder` 的 `npmRebuild` 选项
3. 参考 [electron-builder pnpm 支持讨论](https://github.com/electron-userland/electron-builder/issues/6289)

---

## 3. ELECTRON_RUN_AS_NODE 环境变量

### 问题描述

在 VSCode 环境中运行 Electron 时，`require('electron')` 返回路径字符串而非 API 对象：

```javascript
const electron = require("electron");
console.log(typeof electron); // "string" 而不是 "object"
console.log(electron.app); // undefined
```

### 原因分析

VSCode 作为 Electron 应用，会设置环境变量 `ELECTRON_RUN_AS_NODE=1`。这告诉 Electron 以普通 Node.js 模式运行，而不加载 Electron 的 API。

检查方法：

```bash
env | grep ELECTRON_RUN_AS_NODE
# 输出: ELECTRON_RUN_AS_NODE=1
```

### 解决方案

在启动 Electron 时显式清除此环境变量：

```json
{
  "scripts": {
    "electron:dev": "... && ELECTRON_RUN_AS_NODE= NODE_ENV=development electron .",
    "electron:start": "ELECTRON_RUN_AS_NODE= electron ."
  }
}
```

注意 `ELECTRON_RUN_AS_NODE=` 后面没有值，这会清除（unset）该变量。

### 验证方法

```javascript
// test-electron.js
const { app, BrowserWindow } = require("electron");
console.log("app:", typeof app); // 应该是 "object"
console.log("BrowserWindow:", typeof BrowserWindow); // 应该是 "function"

if (app) {
  app.whenReady().then(() => {
    console.log("Electron ready!");
    app.quit();
  });
}
```

运行测试：

```bash
# 错误方式（在 VSCode 终端中）
./node_modules/.bin/electron test-electron.js
# 输出: app: undefined

# 正确方式
ELECTRON_RUN_AS_NODE= ./node_modules/.bin/electron test-electron.js
# 输出: app: object
```

---

## 4. NODE_ENV 环境变量

### 问题描述

开发模式下 Electron 仍然尝试加载生产构建：

```
Error: Cannot find module '.next/standalone/ai-sdk-computer-use/.next/required-server-files.json'
```

### 原因分析

`main.ts` 中使用 `process.env.NODE_ENV === "development"` 判断开发模式，但在 shell 中运行时 `NODE_ENV` 未设置，默认为 `undefined`。

### 解决方案

在开发脚本中显式设置 `NODE_ENV=development`：

```json
{
  "scripts": {
    "electron:dev": "concurrently \"next dev\" \"tsc -w -p tsconfig-electron.json\" \"wait-on http://localhost:3000 && ELECTRON_RUN_AS_NODE= NODE_ENV=development electron .\""
  }
}
```

---

## 5. Electron API 初始化时机

### 问题描述

在模块顶层调用 `app.getAppPath()` 会导致错误：

```
TypeError: Cannot read properties of undefined (reading 'getAppPath')
```

### 原因分析

Electron 的 `app` 对象在模块加载时可能还未完全初始化。虽然 `app.getPath()` 在官方文档中声明可以在 `ready` 事件前调用，但在某些环境下仍可能失败。

### 错误示例

```typescript
// main.ts - 错误：在模块顶层调用
const appPath = app.getAppPath();
const userDataPath = app.getPath("userData");
```

### 正确做法

延迟到 `app.whenReady()` 后再初始化路径：

```typescript
// main.ts
let paths: { appPath: string; userDataPath: string /* ... */ } | null = null;

function initPaths(): void {
  paths = {
    appPath: app.getAppPath(),
    userDataPath: app.getPath("userData"),
    // ...
  };
}

app.whenReady().then(async () => {
  initPaths();
  // 后续使用 paths
});
```

---

## 6. next-electron-rsc 配置

### 问题描述

使用 `next-electron-rsc` 时，TypeScript 编译报错：

```
'standaloneDir' does not exist in type 'CreateHandlerOptions'
```

### 原因分析

API 参数名称与预期不同。需要查看实际的类型定义。

### 正确配置

```typescript
import { createHandler } from "next-electron-rsc";

// 检查 node_modules/next-electron-rsc/build/index.d.ts 获取正确参数
nextHandler = createHandler({
  protocol, // Electron 的 protocol 模块
  dev: false, // 是否开发模式
  dir: nextDir, // Next.js standalone 目录路径
  debug: false, // 调试模式
});
```

---

## 完整的 package.json 脚本配置

```json
{
  "main": "build/main.js",
  "scripts": {
    "electron:dev": "concurrently \"next dev\" \"tsc -w -p tsconfig-electron.json\" \"wait-on http://localhost:3000 && ELECTRON_RUN_AS_NODE= NODE_ENV=development electron .\"",
    "electron:build": "next build && tsc -p tsconfig-electron.json",
    "electron:start": "ELECTRON_RUN_AS_NODE= electron .",
    "electron:pack": "pnpm electron:build && electron-builder --dir",
    "electron:dist:mac": "pnpm electron:build && electron-builder --mac",
    "electron:dist:win": "pnpm electron:build && electron-builder --win"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["electron", "esbuild", "sharp", "puppeteer"]
  }
}
```

---

## 调试技巧

### 1. 检查 Electron 是否正确加载

```javascript
// 创建 test-electron.js
const { app } = require("electron");
console.log("process.type:", process.type); // 应为 'browser'
console.log("process.versions.electron:", process.versions.electron);
console.log("app:", typeof app); // 应为 'object'
```

### 2. 检查环境变量

```bash
# 查看所有相关环境变量
env | grep -iE "NODE|ELECTRON|NPM|PNPM"
```

### 3. 使用干净环境测试

```bash
# 使用最小化环境运行
env -i PATH=/usr/bin:/bin HOME="$HOME" ./node_modules/.bin/electron test.js
```

---

## 7. macOS Gatekeeper / Quarantine 属性

### 问题描述

打包后的应用双击无反应，没有任何日志输出，进程也没有启动。

### 原因分析

macOS 会给从网络下载或本地构建的应用添加 `com.apple.quarantine` 扩展属性。当应用未经过 Apple 公证（notarize）时，Gatekeeper 会静默阻止其运行。

检查方法：

```bash
xattr -l "dist/mac-arm64/AI Recruitment Assistant.app"
# 如果输出包含 com.apple.quarantine，说明被标记了
```

### 解决方案

**开发测试时**，移除 quarantine 属性：

```bash
xattr -dr com.apple.quarantine "dist/mac-arm64/AI Recruitment Assistant.app"
```

**正式分发时**，应该对应用进行签名和公证：

```yaml
# electron-builder.yml
mac:
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: resources/entitlements.mac.plist
  entitlementsInherit: resources/entitlements.mac.plist
  notarize: true  # 需要 Apple Developer 账号
```

### 注意事项

- 每次重新打包后都需要重新移除 quarantine 属性
- 如果分发给其他用户，他们也会遇到同样问题
- 正式产品必须进行 Apple 公证才能正常分发

---

## 8. Next.js standalone 静态资源缺失

### 问题描述

打包后的应用启动，但页面空白或渲染异常。控制台显示大量 404 错误：

```
[NEXT] Handler http://localhost:3000/_next/static/css/xxx.css 404
[NEXT] Handler http://localhost:3000/_next/static/chunks/xxx.js 404
[NEXT] Handler http://localhost:3000/_next/static/media/xxx.woff2 404
```

### 原因分析

这是 **Next.js standalone 输出模式的设计行为**。根据 [Next.js 官方文档](https://nextjs.org/docs/app/api-reference/config/next-config-js/output#automatically-copying-traced-files)：

> The standalone folder is meant to be deployed on its own. The `.next/static` folder should be served by a CDN ideally.

`next build` 生成的 `.next/standalone/` 目录 **不会自动包含**：
- `.next/static/`（CSS、JS chunks、字体文件）
- `public/`（图片、favicon 等静态资源）

这些文件需要手动复制到 standalone 目录中。

### 解决方案

修改 `electron:build` 脚本，在 `next build` 后自动复制静态资源：

```json
{
  "scripts": {
    "electron:build": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public/* .next/standalone/public/ 2>/dev/null || mkdir -p .next/standalone/public && cp -r public/* .next/standalone/public/ && tsc -p tsconfig-electron.json"
  }
}
```

### 验证方法

打包后检查目录结构：

```bash
# 应该存在这些目录
ls dist/mac-arm64/xxx.app/Contents/Resources/app/.next/standalone/.next/static
ls dist/mac-arm64/xxx.app/Contents/Resources/app/.next/standalone/public
```

### 注意事项

- 这是 Next.js 的设计行为，不是 bug
- 如果使用 CI/CD，记得在构建脚本中加入复制步骤
- `electron-builder.yml` 的 `files` 配置不能解决这个问题，因为路径结构不对

---

## 参考资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [next-electron-rsc](https://github.com/kirill-konshin/next-electron-rsc)
- [electron-builder](https://www.electron.build/)
- [pnpm 设置](https://pnpm.io/settings)

---

_最后更新: 2026-01-15_
