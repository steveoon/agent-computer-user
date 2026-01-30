import type { NextConfig } from "next";

const isElectronBuild = process.env.ELECTRON_BUILD === "true";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  ...(isElectronBuild
    ? {
        outputFileTracingIncludes: {
          "/*": [
            // Next.js 核心依赖
            "./node_modules/.pnpm/styled-jsx@*/node_modules/styled-jsx/**/*",
            "./node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**/*",
            "./node_modules/.pnpm/@next+env@*/node_modules/@next/env/**/*",
            "./node_modules/.pnpm/postcss@*/node_modules/postcss/**/*",
            "./node_modules/.pnpm/caniuse-lite@*/node_modules/caniuse-lite/**/*",
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
