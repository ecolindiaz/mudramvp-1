import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Suspense } from "react";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PostHogProvider } from "@/lib/providers/posthog-provider";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { AnalysisProvider } from "@/components/analysis-context";
import { NonceCspProvider } from "@/lib/providers/nonce-provider";
import "./globals.css";
import NextAuthSessionProvider from "@/components/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Morphiq - GEO Platform",
  description: "Generative Engine Optimization platform for startups",
  icons: {
    icon: "/Mudra-Logo.png",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the per-request nonce set by middleware
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <NextAuthSessionProvider>
          <PostHogProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark" nonce={nonce}>
              <NonceCspProvider nonce={nonce ?? ""}>
                <AnalysisProvider>
                  <Suspense fallback={null}>
                    <PageViewTracker />
                  </Suspense>
                  {children}
                  <Toaster />
                </AnalysisProvider>
              </NonceCspProvider>
              <Analytics />
              <SpeedInsights />
            </ThemeProvider>
          </PostHogProvider>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
