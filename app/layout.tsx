import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import { BrandProvider } from "@/lib/contexts/brand-context";
import { AuthProvider } from "@/components/auth-provider";
import { ConfigInitializer } from "@/components/ConfigInitializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "花卷智能助手 - Huajune AI 餐饮兼职招聘平台",
  description:
    "花卷智能助手（Huajune）是基于 AI 的智能招聘平台，专为餐饮品牌提供高效的兼职招聘解决方案。支持多品牌门店管理、智能候选人匹配、自动化面试邀约，让招聘更精准、更高效。",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      {
        rel: "android-chrome-192x192",
        url: "/android-chrome-192x192.png",
      },
      {
        rel: "android-chrome-512x512",
        url: "/android-chrome-512x512.png",
      },
    ],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <BrandProvider>
            <ConfigInitializer />
            {children}
            <Toaster />
            <Analytics />
          </BrandProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
