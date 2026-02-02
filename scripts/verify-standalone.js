/**
 * verify-standalone.js
 *
 * 在 standalone 构建后运行，验证 Next.js 核心模块是否都能正确解析。
 * 通过实际 require 来检测，能捕获条件分支、动态依赖等静态分析无法覆盖的情况。
 *
 * 用法: node scripts/verify-standalone.js [standalone-dir]
 */

const fs = require("fs");
const path = require("path");
const Module = require("module");

// 仅在 Windows 上运行（支持 ELECTRON_BUILD_PLATFORM 环境变量进行 macOS 模拟测试）
const isWindows =
  process.platform === "win32" || process.env.ELECTRON_BUILD_PLATFORM === "win32";

if (!isWindows) {
  console.log("[verify-standalone] Skipped: only needed on Windows.");
  process.exit(0);
}

const argv = process.argv.slice(2);
let standaloneDirArg = null;
let writeMissing = false;
let missingOutput = null;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--write-missing") {
    writeMissing = true;
    continue;
  }
  if (arg === "--missing-output") {
    missingOutput = argv[i + 1];
    i += 1;
    continue;
  }
  if (!standaloneDirArg) {
    standaloneDirArg = arg;
  }
}

const standaloneDir = path.resolve(standaloneDirArg || ".next/standalone");

// 检查 standalone 目录是否存在
try {
  fs.accessSync(standaloneDir);
} catch {
  console.error(`[verify-standalone] Standalone directory not found: ${standaloneDir}`);
  process.exit(1);
}

// 切换工作目录到 standalone
process.chdir(standaloneDir);

// 重置模块路径，强制从 standalone 目录解析
Module._initPaths();

// Next.js 核心入口点 - 这些是运行时必须能解析的
const entriesToVerify = [
  // 服务器核心
  "next/dist/server/next",
  "next/dist/server/config",
  "next/dist/server/require-hook",
  // 共享库
  "next/dist/shared/lib/constants",
  "next/dist/shared/lib/router/router",
  // 核心依赖（使用具体子路径以精确检测）
  "styled-jsx/style",
  "@swc/helpers/_/_interop_require_default", // 之前报错的具体路径
  "@next/env",
  "client-only", // React 相关
  "react-dom/server.browser",
  "detect-libc",
  "semver/functions/coerce",
  "sharp",
];

console.log(`[verify-standalone] Verifying modules in: ${standaloneDir}\n`);

const missing = [];
const resolved = [];

for (const entry of entriesToVerify) {
  try {
    // 必须指定 paths 选项，否则 require.resolve 会从脚本位置解析而非 standaloneDir
    const resolvedPath = require.resolve(entry, { paths: [standaloneDir] });
    resolved.push({ entry, path: resolvedPath });
    console.log(`  ✅ ${entry}`);
  } catch (e) {
    if (e.code === "MODULE_NOT_FOUND") {
      // 提取实际缺失的模块名
      const match = e.message.match(/Cannot find module '([^']+)'/);
      const missingModule = match ? match[1] : entry;
      missing.push({ entry, missing: missingModule, error: e.message });
      console.log(`  ❌ ${entry}`);
      console.log(`     Missing: ${missingModule}`);
    } else {
      // 其他错误也记录
      missing.push({ entry, missing: entry, error: e.message });
      console.log(`  ❌ ${entry}`);
      console.log(`     Error: ${e.message}`);
    }
  }
}

console.log("");

if (missing.length > 0) {
  if (writeMissing) {
    const outputPath =
      missingOutput || path.join(standaloneDir, ".missing-modules.json");
    const uniqueMissing = Array.from(
      new Set(missing.map((item) => item.missing))
    );
    try {
      fs.writeFileSync(
        outputPath,
        JSON.stringify({ missing: uniqueMissing, entries: missing }, null, 2)
      );
      console.error(`[verify-standalone] Missing list written to: ${outputPath}`);
    } catch (err) {
      console.error(`[verify-standalone] Failed to write missing list: ${err}`);
    }
  }
  console.error(`[verify-standalone] ❌ ${missing.length} module(s) failed verification:\n`);
  for (const { entry, missing: mod } of missing) {
    console.error(`  - ${entry} (needs: ${mod})`);
  }
  console.error("\nStandalone build is incomplete. Add missing packages to:");
  console.error("  1. next.config.ts outputFileTracingIncludes");
  console.error("  2. scripts/resolve-standalone.js requiredPackages\n");
  process.exit(1);
}

console.log(`[verify-standalone] ✅ All ${resolved.length} modules verified successfully.`);
