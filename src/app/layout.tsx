import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Suspense } from "react";

import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import SetupCheck from "@/components/SetupCheck";
import { getLeagueIdsFromDb } from "@/lib/server/league-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fantasy Football League",
  description: "Dynasty fantasy football league management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch league IDs server-side so client components can read them from
  // window.__LEAGUE_CONFIG__ without an extra round-trip.
  let leagueConfig = { current: '', previous: {} as Record<string, string> };
  try {
    leagueConfig = await getLeagueIdsFromDb();
  } catch {
    // If DB isn't ready yet (e.g. pre-setup), leave config empty — pages will
    // show their own empty/setup states.
  }

  const leagueConfigJson = JSON.stringify({
    currentLeagueId: leagueConfig.current,
    previousLeagueIds: leagueConfig.previous,
  });

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-hydration theme setter — avoids flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try {
              const saved = localStorage.getItem('theme');
              const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              const theme = saved || (prefersDark ? 'dark' : 'light');
              const el = document.documentElement;
              el.setAttribute('data-theme', theme);
              el.style.setProperty('color-scheme', theme);
            } catch (e) {} })();`,
          }}
        />
        {/* League config injected from DB so client components have the Sleeper
            league ID without needing SLEEPER_LEAGUE_ID set as a build-time env var. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__LEAGUE_CONFIG__ = ${leagueConfigJson};`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <SetupCheck>
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </SetupCheck>
        <Analytics />
      </body>
    </html>
  );
}
