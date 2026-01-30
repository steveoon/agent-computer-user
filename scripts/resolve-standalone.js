const fs = require("fs");
const path = require("path");

if (process.platform !== "win32") {
  console.log("[resolve-standalone] Skipped: only needed on Windows.");
  process.exit(0);
}

const src = path.resolve(process.argv[2] || ".next/standalone");
const tempDest = path.resolve(process.argv[3] || ".next/standalone-resolved");
const projectRoot = path.resolve(__dirname, "..");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

if (!exists(src)) {
  console.error(`[resolve-standalone] Source not found: ${src}`);
  process.exit(1);
}

if (exists(tempDest)) {
  fs.rmSync(tempDest, { recursive: true, force: true });
}

fs.mkdirSync(tempDest, { recursive: true });

try {
  fs.cpSync(src, tempDest, { recursive: true, dereference: true });
} catch (err) {
  console.error(`[resolve-standalone] Copy failed: ${err}`);
  process.exit(1);
}

const serverJsPath = path.join(tempDest, "server.js");
if (!exists(serverJsPath)) {
  console.error(`[resolve-standalone] Missing server.js after copy: ${serverJsPath}`);
  process.exit(1);
}

// Next.js 核心依赖 - 这些是运行时必需的
// client-only/server-only 由 outputFileTracingIncludes 处理（exports 限制）
const requiredPackages = ["styled-jsx", "@swc/helpers", "@next/env"];
const standaloneNodeModules = path.join(tempDest, "node_modules");

const packageChecks = {
  "@swc/helpers": [
    // _interop_require_default 是目录，检查其 package.json
    [path.join("_", "_interop_require_default", "package.json")],
  ],
};

function hasRequiredFiles(pkgDir, checks) {
  if (!checks || checks.length === 0) return true;
  return checks.every((alternatives) => alternatives.some((rel) => exists(path.join(pkgDir, rel))));
}

for (const pkg of requiredPackages) {
  const standalonePkgPath = path.join(standaloneNodeModules, pkg, "package.json");
  const standalonePkgDir = path.dirname(standalonePkgPath);
  const checks = packageChecks[pkg];
  if (exists(standalonePkgPath) && hasRequiredFiles(standalonePkgDir, checks)) {
    continue;
  }

  let srcPkgDir = path.join(projectRoot, "node_modules", pkg);
  if (!exists(srcPkgDir)) {
    try {
      // 尝试直接解析
      const resolvedPkgJson = require.resolve(`${pkg}/package.json`, {
        paths: [projectRoot],
      });
      srcPkgDir = path.dirname(resolvedPkgJson);
    } catch {
      // fallback: 通过 next 的位置来解析（styled-jsx 是 next 的依赖）
      try {
        const nextPkgPath = require.resolve("next/package.json", {
          paths: [projectRoot],
        });
        const nextDir = path.dirname(nextPkgPath);
        const resolvedPkgJson = require.resolve(`${pkg}/package.json`, {
          paths: [nextDir],
        });
        srcPkgDir = path.dirname(resolvedPkgJson);
      } catch {
        console.error(
          `[resolve-standalone] Missing dependency in project: ${pkg}`
        );
        process.exit(1);
      }
    }
  }

  const destPkgDir = path.join(standaloneNodeModules, pkg);
  fs.mkdirSync(path.dirname(destPkgDir), { recursive: true });
  if (exists(destPkgDir)) {
    fs.rmSync(destPkgDir, { recursive: true, force: true });
  }
  try {
    fs.cpSync(srcPkgDir, destPkgDir, { recursive: true, dereference: true });
    console.log(`[resolve-standalone] Copied ${pkg} into standalone node_modules.`);
  } catch (err) {
    console.error(`[resolve-standalone] Failed to copy ${pkg}: ${err}`);
    process.exit(1);
  }

  if (!exists(path.join(destPkgDir, "package.json")) || !hasRequiredFiles(destPkgDir, checks)) {
    console.error(`[resolve-standalone] ${pkg} still missing after copy: ${destPkgDir}`);
    process.exit(1);
  }
}

try {
  fs.rmSync(src, { recursive: true, force: true });
  fs.renameSync(tempDest, src);
} catch (err) {
  console.error(`[resolve-standalone] Swap failed: ${err}`);
  process.exit(1);
}

console.log("[resolve-standalone] Standalone directory materialized successfully.");
