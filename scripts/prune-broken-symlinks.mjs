#!/usr/bin/env node
/**
 * Cross-platform script to remove broken symbolic links.
 * Replaces Unix `find <dir> -type l ! -exec test -e {} \; -delete`
 * which fails on Windows (find.exe is a different command).
 *
 * Usage: node scripts/prune-broken-symlinks.mjs <directory>
 */

import { readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

function pruneDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // Directory doesn't exist or can't be read — skip silently
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      try {
        statSync(fullPath); // follows the link — throws if target is missing
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          try {
            unlinkSync(fullPath);
          } catch (unlinkError) {
            // Link already removed by another process — ignore
            if (
              !(
                unlinkError &&
                typeof unlinkError === "object" &&
                "code" in unlinkError &&
                unlinkError.code === "ENOENT"
              )
            ) {
              throw unlinkError;
            }
          }
        } else {
          throw error;
        }
      }
    } else if (entry.isDirectory()) {
      pruneDir(fullPath);
    }
  }
}

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/prune-broken-symlinks.mjs <directory>");
  process.exit(1);
}

pruneDir(target);
