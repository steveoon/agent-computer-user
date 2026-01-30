const fs = require("fs");
const path = require("path");

if (process.platform !== "win32") {
  console.log("[resolve-standalone] Skipped: only needed on Windows.");
  process.exit(0);
}

const src = path.resolve(process.argv[2] || ".next/standalone");
const tempDest = path.resolve(process.argv[3] || ".next/standalone-resolved");

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

try {
  fs.rmSync(src, { recursive: true, force: true });
  fs.renameSync(tempDest, src);
} catch (err) {
  console.error(`[resolve-standalone] Swap failed: ${err}`);
  process.exit(1);
}

console.log("[resolve-standalone] Standalone directory materialized successfully.");
