const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

if (process.platform !== "win32") {
  console.log("[resolve-standalone] Skipped: only needed on Windows.");
  process.exit(0);
}

const args = process.argv.slice(2);
const isAutoFix = args.includes("--auto") || process.env.RESOLVE_STANDALONE_AUTOFIX === "true";
const standaloneArg = args.find((arg) => !arg.startsWith("-")) || ".next/standalone";
const src = path.resolve(standaloneArg);
const tempDest = path.resolve(".next/standalone-resolved");
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
const requiredPackages = [
  "styled-jsx",
  "@swc/helpers",
  "@next/env",
  "react-dom",
  "detect-libc",
  "client-only",
  "semver",
  "sharp",
  "@img/sharp-win32-x64",
  "@img/sharp-libvips-win32-x64",
  "@img/sharp-win32-arm64",
  "@img/sharp-libvips-win32-arm64",
];

const optionalPackages = new Set([
  "@img/sharp-win32-arm64",
  "@img/sharp-libvips-win32-arm64",
]);

const packageChecks = {
  "@swc/helpers": [
    // _interop_require_default 是目录，检查其 package.json
    [path.join("_", "_interop_require_default", "package.json")],
  ],
  semver: [[path.join("functions", "coerce.js")]],
  sharp: [[path.join("lib", "sharp.js")]],
};

function hasRequiredFiles(pkgDir, checks) {
  if (!checks || checks.length === 0) return true;
  return checks.every((alternatives) => alternatives.some((rel) => exists(path.join(pkgDir, rel))));
}

const resolveBases = [projectRoot];

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

const nextPkgPath = tryResolve("next/package.json", resolveBases);
if (nextPkgPath) {
  resolveBases.push(path.dirname(nextPkgPath));
}

const sharpPkgPath = tryResolve("sharp/package.json", resolveBases);
if (sharpPkgPath) {
  resolveBases.push(path.dirname(sharpPkgPath));
}

function getPackageName(request) {
  if (request.startsWith("@")) {
    const parts = request.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : request;
  }
  return request.split("/")[0];
}

function ensurePackages(packages, standaloneDir) {
  const standaloneNodeModules = path.join(standaloneDir, "node_modules");
  for (const pkg of packages) {
    const pkgName = getPackageName(pkg);
    const standalonePkgPath = path.join(standaloneNodeModules, pkgName, "package.json");
    const standalonePkgDir = path.dirname(standalonePkgPath);
    const checks = packageChecks[pkgName];
    if (exists(standalonePkgPath) && hasRequiredFiles(standalonePkgDir, checks)) {
      continue;
    }

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
          } else {
            if (optionalPackages.has(pkgName)) {
              console.warn(`[resolve-standalone] Optional dependency not found: ${pkgName}`);
              continue;
            }
            console.error(`[resolve-standalone] Missing dependency in project: ${pkgName}`);
            process.exit(1);
          }
        } else {
          if (optionalPackages.has(pkgName)) {
            console.warn(`[resolve-standalone] Optional dependency not found: ${pkgName}`);
            continue;
          }
          console.error(`[resolve-standalone] Missing dependency in project: ${pkgName}`);
          process.exit(1);
        }
      }
    }

    const destPkgDir = path.join(standaloneNodeModules, pkgName);
    fs.mkdirSync(path.dirname(destPkgDir), { recursive: true });
    if (exists(destPkgDir)) {
      fs.rmSync(destPkgDir, { recursive: true, force: true });
    }
    try {
      fs.cpSync(srcPkgDir, destPkgDir, { recursive: true, dereference: true });
      console.log(`[resolve-standalone] Copied ${pkgName} into standalone node_modules.`);
    } catch (err) {
      console.error(`[resolve-standalone] Failed to copy ${pkgName}: ${err}`);
      process.exit(1);
    }

    if (!exists(path.join(destPkgDir, "package.json")) || !hasRequiredFiles(destPkgDir, checks)) {
      console.error(`[resolve-standalone] ${pkgName} still missing after copy: ${destPkgDir}`);
      process.exit(1);
    }
  }
}

ensurePackages(requiredPackages, tempDest);

if (isAutoFix) {
  const missingPath = path.join(tempDest, ".missing-modules.json");
  const verifyScript = path.join(projectRoot, "scripts", "verify-standalone.js");
  spawnSync(
    process.execPath,
    [verifyScript, tempDest, "--write-missing", "--missing-output", missingPath],
    { stdio: "inherit" }
  );

  if (exists(missingPath)) {
    try {
      const payload = JSON.parse(fs.readFileSync(missingPath, "utf-8"));
      const missingPackages = Array.isArray(payload.missing) ? payload.missing : [];
      if (missingPackages.length > 0) {
        console.log(`[resolve-standalone] Auto-fix missing packages: ${missingPackages.join(", ")}`);
        ensurePackages(missingPackages, tempDest);
      }
    } catch (err) {
      console.warn(`[resolve-standalone] Failed to read missing list: ${err}`);
    }
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
