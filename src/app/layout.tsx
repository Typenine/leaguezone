import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Suspense } from "react";
import { cookies } from "next/headers";

import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import SetupCheck from "@/components/SetupCheck";
import LeagueThemeScope from "@/components/LeagueThemeScope";
import { TeamLogoProvider } from "@/contexts/TeamLogoContext";
import { getLeagueIdsFromDb, getLeagueBranding } from "@/lib/server/league-config";
import { discoverLeagueChain } from "@/lib/utils/sleeper-api";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LeagueZone HQ — Custom Fantasy League Websites",
  description: "Custom fantasy football league websites for serious dynasty commissioners.",
  icons: {
    icon: [{ url: "/assets/LeagueZone HQ Logo.png", sizes: "512x512", type: "image/png" }],
    shortcut: "/assets/LeagueZone HQ Logo.png",
    apple: [{ url: "/assets/LeagueZone HQ Logo.png", sizes: "512x512" }],
  },
  viewport: "width=device-width, initial-scale=1",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the active league cookie so multi-league sites show the right data.
  const cookieJar = await cookies();
  const activeLeagueId = cookieJar.get('active_league_id')?.value || undefined;

  // Fetch league IDs server-side so client components can read them from
  // window.__LEAGUE_CONFIG__ without an extra round-trip.
  let leagueConfig = { current: '', previous: {} as Record<string, string> };
  try {
    leagueConfig = await getLeagueIdsFromDb(activeLeagueId);
  } catch {
    // If DB isn't ready yet (e.g. pre-setup), leave config empty â€” pages will
    // show their own empty/setup states.
  }

  // Fetch branding for the active league (colors, logo, name).
  let branding = {
    name: '',
    shortName: null as string | null,
    logoUrl: null as string | null,
    primaryColor: null as string | null,
    secondaryColor: null as string | null,
    rulesContent: null as string | null,
    rulesFileKey: null as string | null,
  };
  try {
    branding = await getLeagueBranding(activeLeagueId);
  } catch {
    // Non-fatal
  }

  // If no previous seasons were explicitly saved (e.g. user only entered the
  // current league ID during setup), auto-discover the full history by following
  // the Sleeper previous_league_id chain. Results are cached in-process (1 hr
  // TTL on getLeague), so this does not hit the Sleeper API on every request.
  let previousLeagueIds = leagueConfig.previous;
  if (leagueConfig.current && Object.keys(previousLeagueIds).length === 0) {
    try {
      const chain = await discoverLeagueChain(leagueConfig.current);
      // chain includes current season â€” extract only previous entries
      previousLeagueIds = Object.fromEntries(
        Object.entries(chain).filter(([, id]) => id !== leagueConfig.current)
      );
    } catch {
      // Non-fatal â€” history pages will just show only current season
    }
  }

  const leagueConfigJson = JSON.stringify({
    currentLeagueId: leagueConfig.current,
    previousLeagueIds,
  });

  const leagueBrandingJson = JSON.stringify({
    name: branding.name,
    shortName: branding.shortName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
  });

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-hydration theme setter â€” avoids flash */}
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
        {/* League branding injected for client-side access */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__LEAGUE_BRANDING__ = ${leagueBrandingJson};`,
          }}
        />
        {/* Expose league colors; LeagueThemeScope decides when they override site tokens. */}
        {(branding.primaryColor || branding.secondaryColor) && (
          <style
            dangerouslySetInnerHTML={{
              __html: `:root { ${branding.primaryColor ? `--league-accent: ${branding.primaryColor};` : ''} ${branding.secondaryColor ? `--league-gold: ${branding.secondaryColor};` : ''} }`,
            }}
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <Suspense fallback={null}>
          <LeagueThemeScope />
        </Suspense>
        <TeamLogoProvider>
          <Suspense fallback={null}>
            <SetupCheck>
              <Suspense fallback={null}>
                <Navbar />
              </Suspense>
              <main className="flex-grow">
                {children}
              </main>
              <Footer />
            </SetupCheck>
          </Suspense>
        </TeamLogoProvider>
        <Analytics />
      </body>
    </html>
  );
}


