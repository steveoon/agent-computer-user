const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// =============================================================================
// 物理化 runtime 依赖树 - 根治 Windows standalone 依赖缺失问题
// =============================================================================
// 问题根因：pnpm isolated 模式 + NFT 静态追踪 + Windows symlink 限制
// 解决思路：用 pnpm 生成真实 node_modules，物理化复制到 standalone
// =============================================================================

// 平台检测：支持 ELECTRON_BUILD_PLATFORM 环境变量（允许 macOS 模拟测试）
const isWindows =
  process.platform === "win32" || process.env.ELECTRON_BUILD_PLATFORM === "win32";

if (!isWindows) {
  console.log("[resolve-standalone] Skipped: only needed on Windows.");
  process.exit(0);
}

const projectRoot = path.resolve(__dirname, "..");
const standaloneDir = path.resolve(projectRoot, ".next/standalone");
const tempRuntimeDir = path.resolve(projectRoot, ".next/standalone-runtime");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

// 验证 standalone 目录存在
if (!exists(standaloneDir)) {
  console.error(`[resolve-standalone] Standalone directory not found: ${standaloneDir}`);
  process.exit(1);
}

const serverJsPath = path.join(standaloneDir, "server.js");
if (!exists(serverJsPath)) {
  console.error(`[resolve-standalone] Missing server.js: ${serverJsPath}`);
  process.exit(1);
}

console.log("[resolve-standalone] Starting dependency physicalization for Windows...");

// =============================================================================
// Step 0: 清理临时目录（避免旧的 node_modules 误判"成功"）
// =============================================================================
if (exists(tempRuntimeDir)) {
  console.log("[resolve-standalone] Cleaning up temp directory...");
  fs.rmSync(tempRuntimeDir, { recursive: true, force: true });
}
fs.mkdirSync(tempRuntimeDir, { recursive: true });

// =============================================================================
// Step 1: 尝试 pnpm deploy（首选，但对非 workspace 项目会失败）
// =============================================================================
console.log("[resolve-standalone] Attempting pnpm deploy --prod...");
let deploySuccess = false;

const deployResult = spawnSync("pnpm", ["deploy", "--prod", tempRuntimeDir], {
  stdio: "inherit",
  cwd: projectRoot,
});

// 严格的可用性检测 + 诊断信息
if (deployResult.status !== 0 || deployResult.error) {
  console.log(`[resolve-standalone] pnpm deploy status: ${deployResult.status}`);
  console.log(`[resolve-standalone] pnpm deploy error: ${deployResult.error || "none"}`);
}

deploySuccess =
  deployResult.status === 0 &&
  !deployResult.error &&
  exists(path.join(tempRuntimeDir, "node_modules"));

// =============================================================================
// Step 2: Fallback 到 pnpm install --prod（复制完整 manifest）
// =============================================================================
if (!deploySuccess) {
  console.log(
    "[resolve-standalone] pnpm deploy failed (expected for non-workspace), falling back to pnpm install --prod"
  );

  // 清理失败的 deploy 残留
  if (exists(tempRuntimeDir)) {
    fs.rmSync(tempRuntimeDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempRuntimeDir, { recursive: true });

  // 复制完整 manifest + lock + 所有配置文件
  const filesToCopy = ["package.json", "pnpm-lock.yaml", ".npmrc", ".pnpmfile.cjs"];
  for (const file of filesToCopy) {
    const srcPath = path.join(projectRoot, file);
    if (exists(srcPath)) {
      fs.copyFileSync(srcPath, path.join(tempRuntimeDir, file));
      console.log(`[resolve-standalone] Copied ${file}`);
    }
  }

  console.log("[resolve-standalone] Running pnpm install --prod --frozen-lockfile --ignore-workspace...");
  const installResult = spawnSync(
    "pnpm",
    ["install", "--prod", "--frozen-lockfile", "--ignore-workspace"],
    {
      stdio: "inherit",
      cwd: tempRuntimeDir,
    }
  );

  // 如果 fallback 也失败，必须退出
  if (installResult.status !== 0) {
    console.error(`[resolve-standalone] pnpm install failed with status: ${installResult.status}`);
    process.exit(1);
  }

  if (!exists(path.join(tempRuntimeDir, "node_modules"))) {
    console.error("[resolve-standalone] Both pnpm deploy and pnpm install failed!");
    process.exit(1);
  }

  console.log("[resolve-standalone] pnpm install --prod succeeded.");
}

// =============================================================================
// Step 3: 清空旧 node_modules（避免混入 NFT 残留包）
// =============================================================================
const standaloneNodeModules = path.join(standaloneDir, "node_modules");
if (exists(standaloneNodeModules)) {
  console.log("[resolve-standalone] Removing old standalone node_modules...");
  fs.rmSync(standaloneNodeModules, { recursive: true, force: true });
}

// =============================================================================
// Step 4: 用 dereference: true 强制物理化复制
// =============================================================================
console.log("[resolve-standalone] Copying node_modules with dereference (physicalization)...");
try {
  fs.cpSync(path.join(tempRuntimeDir, "node_modules"), standaloneNodeModules, {
    recursive: true,
    dereference: true,
  });
} catch (err) {
  console.error(`[resolve-standalone] Copy failed: ${err}`);
  process.exit(1);
}

// =============================================================================
// Step 5: 硬性校验是否仍有 symlink/junction（使用 fs.lstatSync）
// =============================================================================
console.log("[resolve-standalone] Validating no symlinks remain...");

function hasSymlinks(dir, depth = 0) {
  // 防止无限递归（正常 node_modules 不会超过 10 层）
  if (depth > 15) return false;

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    console.warn(`[resolve-standalone] Cannot read dir: ${dir} - ${err.message}`);
    return false; // 继续检查其他目录
  }

  for (const name of entries) {
    const fullPath = path.join(dir, name);
    try {
      const stat = fs.lstatSync(fullPath);
      if (stat.isSymbolicLink()) {
        console.error(`[resolve-standalone] Found symlink: ${fullPath}`);
        return true;
      }
      if (stat.isDirectory()) {
        if (hasSymlinks(fullPath, depth + 1)) return true;
      }
    } catch (err) {
      console.warn(`[resolve-standalone] Cannot stat: ${fullPath} - ${err.message}`);
      // 继续检查其他文件
    }
  }
  return false;
}

if (hasSymlinks(standaloneNodeModules)) {
  console.error(
    "[resolve-standalone] ERROR: symlinks/junctions still present after dereference!"
  );
  process.exit(1);
}

console.log("[resolve-standalone] Symlink validation passed.");

// =============================================================================
// Step 6: 补充 Next.js 核心依赖（pnpm isolated 模式下可能缺失）
// =============================================================================
// 这些包是 next 的嵌套依赖，在 pnpm isolated 模式下不会被安装到顶层
// 需要从项目的 node_modules 中复制到 standalone
const criticalPackages = [
  "styled-jsx",
  "@swc/helpers",
  "@next/env",
  "client-only",
  "server-only",
];

console.log("[resolve-standalone] Ensuring critical Next.js dependencies...");

function getPackageName(request) {
  if (request.startsWith("@")) {
    const parts = request.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : request;
  }
  return request.split("/")[0];
}

function tryResolve(request, bases) {
  for (const base of bases) {
    try {
      return require.resolve(request, { paths: [base] });
    } catch {
      // Try next base
    }
  }
  return null;
}

function findPackageRootFromEntry(entryPath, pkgName) {
  let dir = path.dirname(entryPath);
  while (dir && dir !== path.dirname(dir)) {
    const pkgJson = path.join(dir, "package.json");
    if (exists(pkgJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf-8"));
        if (pkg.name === pkgName) {
          return dir;
        }
      } catch {
        // Ignore invalid package.json
      }
    }
    dir = path.dirname(dir);
  }
  return null;
}

// Build resolve bases from project root and key packages
const resolveBases = [projectRoot];
const nextPkgPath = tryResolve("next/package.json", resolveBases);
if (nextPkgPath) {
  resolveBases.push(path.dirname(nextPkgPath));
}

for (const pkg of criticalPackages) {
  const pkgName = getPackageName(pkg);
  const standalonePkgPath = path.join(standaloneNodeModules, pkgName, "package.json");

  // Skip if already exists in standalone
  if (exists(standalonePkgPath)) {
    console.log(`  ✅ ${pkgName} (already present)`);
    continue;
  }

  // Find source package
  let srcPkgDir = path.join(projectRoot, "node_modules", pkgName);
  if (!exists(srcPkgDir)) {
    const resolvedPkgJson = tryResolve(`${pkgName}/package.json`, resolveBases);
    if (resolvedPkgJson) {
      srcPkgDir = path.dirname(resolvedPkgJson);
    } else {
      const resolvedEntry = tryResolve(pkg, resolveBases);
      if (resolvedEntry) {
        const root = findPackageRootFromEntry(resolvedEntry, pkgName);
        if (root) {
          srcPkgDir = root;
        }
      }
    }
  }

  if (!exists(srcPkgDir)) {
    console.warn(`  ⚠️ ${pkgName} (not found, may be optional)`);
    continue;
  }

  // Copy package to standalone
  const destPkgDir = path.join(standaloneNodeModules, pkgName);
  fs.mkdirSync(path.dirname(destPkgDir), { recursive: true });
  if (exists(destPkgDir)) {
    fs.rmSync(destPkgDir, { recursive: true, force: true });
  }
  try {
    fs.cpSync(srcPkgDir, destPkgDir, { recursive: true, dereference: true });
    console.log(`  ✅ ${pkgName} (copied from project node_modules)`);
  } catch (err) {
    console.error(`  ❌ ${pkgName} failed to copy: ${err}`);
    process.exit(1);
  }
}

// =============================================================================
// Step 7: 清理临时目录
// =============================================================================
console.log("[resolve-standalone] Cleaning up temp directory...");
fs.rmSync(tempRuntimeDir, { recursive: true, force: true });

console.log("[resolve-standalone] Standalone directory physicalized successfully.");
