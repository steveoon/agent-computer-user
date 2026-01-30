import type { NextConfig } from "next";

const isElectronBuild = process.env.ELECTRON_BUILD === "true";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  ...(isElectronBuild
    ? {
        outputFileTracingIncludes: {
          "/*": [
            "./node_modules/.pnpm/**/styled-jsx/**/*",
            "./node_modules/.pnpm/**/@swc/helpers/**/*",
            "./node_modules/.pnpm/**/client-only/**/*",
            "./node_modules/.pnpm/**/server-only/**/*",
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
