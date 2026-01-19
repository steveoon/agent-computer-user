/**
 * Fix PATH for macOS/Linux GUI apps
 *
 * When an Electron app is launched by double-clicking the icon in Finder,
 * it doesn't inherit the user's shell PATH. This causes issues when trying
 * to spawn commands like `npx` that are installed via Homebrew or nvm.
 *
 * This module reads the PATH from the user's default shell and merges it
 * with the current process.env.PATH.
 *
 * @see ELECTRON_INTEGRATION_GUIDE.md - Section 9 for detailed documentation
 */

import { execSync } from "child_process";

/**
 * Fix PATH for macOS/Linux GUI apps (when launched via Finder double-click)
 *
 * Shell configuration files:
 * - Login shell (-l): reads .bash_profile/.zprofile (login configs)
 * - Interactive shell (-i): reads .bashrc/.zshrc (interactive configs)
 * - Most users put PATH in .bashrc/.zshrc, so we need -il to capture both
 *
 * Shell compatibility:
 * - bash/zsh: Uses `-ilc` with strong output sanitization
 * - fish: Uses `-lc` with fish-specific syntax (PATH uses space separator)
 */
export function fixPath(): void {
  if (process.platform !== "darwin" && process.platform !== "linux") {
    return;
  }

  try {
    // Platform-aware default shell:
    // - macOS: default shell is zsh since Catalina
    // - Linux: default shell is usually bash
    const defaultShell = process.platform === "darwin" ? "/bin/zsh" : "/bin/bash";
    const shell = process.env.SHELL || defaultShell;
    const isFish = shell.includes("fish");

    // Build shell command based on shell type
    // Use -il (interactive login) to load both .profile AND .bashrc/.zshrc
    // This is necessary because nvm/volta/Homebrew often configure PATH in .bashrc/.zshrc
    // fish doesn't need -i flag and uses space-separated PATH
    const command = isFish
      ? `${shell} -lc 'echo $PATH'`
      : `${shell} -ilc 'echo -n "$PATH"'`;

    const output = execSync(command, {
      encoding: "utf8",
      timeout: 5000, // Allow time for interactive shell init
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Extract valid PATH from potentially noisy output:
    // 1. Remove ANSI escape codes (colored prompts, etc.)
    // 2. Find lines that look like PATH (colon-separated absolute paths)
    // 3. Validate the extracted PATH
    const cleanedOutput = output
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "") // Remove ANSI escape codes
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, ""); // Remove other control chars

    // For fish, PATH is space-separated; for others, colon-separated
    const separator = isFish ? " " : ":";
    const pathPattern = isFish
      ? /^(\/[^\s]+\s*)+$/ // Space-separated absolute paths
      : /^(\/[^:]+:)*\/[^:]+$/; // Colon-separated absolute paths

    // Find the line that looks most like a PATH
    const lines = cleanedOutput.split("\n").map((l) => l.trim()).filter(Boolean);
    let extractedPath: string | null = null;

    // Strategy 1: Find a line matching PATH pattern
    for (const line of lines) {
      if (pathPattern.test(line) && line.length > 10) {
        extractedPath = line;
        break;
      }
    }

    // Strategy 2: If no match, try the last non-empty line (fallback)
    if (!extractedPath && lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      // Validate it at least starts with / and contains separator
      if (lastLine.startsWith("/") && lastLine.includes(isFish ? " " : ":")) {
        extractedPath = lastLine;
      }
    }

    if (extractedPath) {
      const currentPath = process.env.PATH || "";
      const shellPaths = extractedPath.split(separator).filter(Boolean);
      const currentPaths = currentPath.split(":").filter(Boolean);

      // Validate extracted paths (each should be an absolute path)
      const validShellPaths = shellPaths.filter((p) => p.startsWith("/"));

      if (validShellPaths.length > 0) {
        // Merge paths, putting shell paths first (they usually have priority)
        const mergedPaths = new Set([...validShellPaths, ...currentPaths]);
        process.env.PATH = [...mergedPaths].join(":");
      }
    }
  } catch {
    // Silently fail - this is best-effort
    // Don't log error to avoid noise in production
  }
}
