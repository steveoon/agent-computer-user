import type { NextConfig } from "next";

const isElectronBuild = process.env.ELECTRON_BUILD === "true";
const isWindowsElectronBuild =
  isElectronBuild &&
  (process.platform === "win32" || process.env.ELECTRON_BUILD_PLATFORM === "win32");

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  ...(isWindowsElectronBuild
    ? {
        outputFileTracingIncludes: {
          "/*": [
            // Next.js 核心依赖
            "./node_modules/.pnpm/styled-jsx@*/node_modules/styled-jsx/**/*",
            "./node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**/*",
            "./node_modules/.pnpm/@next+env@*/node_modules/@next/env/**/*",
            "./node_modules/.pnpm/postcss@*/node_modules/postcss/**/*",
            "./node_modules/.pnpm/caniuse-lite@*/node_modules/caniuse-lite/**/*",
            "./node_modules/.pnpm/react-dom@*/node_modules/react-dom/**/*",
            "./node_modules/.pnpm/detect-libc@*/node_modules/detect-libc/**/*",
            "./node_modules/.pnpm/semver@*/node_modules/semver/**/*",
            "./node_modules/.pnpm/sharp@*/node_modules/sharp/**/*",
            "./node_modules/.pnpm/@img+sharp-win32-x64@*/node_modules/@img/sharp-win32-x64/**/*",
            "./node_modules/.pnpm/@img+sharp-libvips-win32-x64@*/node_modules/@img/sharp-libvips-win32-x64/**/*",
            "./node_modules/.pnpm/@img+sharp-win32-arm64@*/node_modules/@img/sharp-win32-arm64/**/*",
            "./node_modules/.pnpm/@img+sharp-libvips-win32-arm64@*/node_modules/@img/sharp-libvips-win32-arm64/**/*",
            // React 相关
            "./node_modules/.pnpm/client-only@*/node_modules/client-only/**/*",
            "./node_modules/.pnpm/server-only@*/node_modules/server-only/**/*",
          ],
        },
      }
    : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "frame-src https://*.e2b.dev https://*.e2b.app https://va.vercel-scripts.com",
              "frame-ancestors 'self' https://*.e2b.dev https://*.e2b.app",
              "connect-src 'self' https://*.e2b.dev https://*.e2b.app https://*.supabase.co https://*.duliday.com",
              "img-src 'self' data: https://*.e2b.dev https://*.e2b.app",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.e2b.dev https://*.e2b.app https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
