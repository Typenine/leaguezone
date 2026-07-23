import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { Suspense } from 'react';
import { cookies } from 'next/headers';

import UnifiedNavbar from '@/components/layout/UnifiedNavbar';
import GlobalLeagueSwitcher from '@/components/GlobalLeagueSwitcher';
import Footer from '@/components/layout/footer';
import LeagueThemeScope from '@/components/LeagueThemeScope';
import { TeamLogoProvider } from '@/contexts/TeamLogoContext';
import { getLeagueById } from '@/lib/server/league-context';
import { discoverLeagueChain } from '@/lib/utils/sleeper-api';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LeagueZone HQ — Custom Fantasy League Websites',
  description: 'Custom fantasy football league websites for serious dynasty commissioners.',
  icons: {
    icon: [{ url: '/assets/LeagueZone HQ Logo.png', sizes: '512x512', type: 'image/png' }],
    shortcut: '/assets/LeagueZone HQ Logo.png',
    apple: [{ url: '/assets/LeagueZone HQ Logo.png', sizes: '512x512' }],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieJar = await cookies();
  const activeLeagueId = cookieJar.get('active_league_id')?.value || null;
  const activeLeague = activeLeagueId ? await getLeagueById(activeLeagueId) : null;
  const currentLeagueId = activeLeague?.sleeperLeagueId || '';
  let allLeagueIds = activeLeague?.sleeperLeagueIds || {};

  if (currentLeagueId && Object.keys(allLeagueIds).length === 0) {
    try {
      allLeagueIds = await discoverLeagueChain(currentLeagueId);
    } catch {
      // History pages can still render the current season.
    }
  }

  const currentSeason = Object.entries(allLeagueIds)
    .find(([, id]) => id === currentLeagueId)?.[0] || '';
  const previousLeagueIds = Object.fromEntries(
    Object.entries(allLeagueIds).filter(([, id]) => id !== currentLeagueId),
  );

  const leagueConfigJson = JSON.stringify({ currentLeagueId, currentSeason, previousLeagueIds }).replace(/</g, '\\u003c');
  const leagueBrandingJson = JSON.stringify({
    name: activeLeague?.name || '',
    shortName: activeLeague?.shortName || null,
    logoUrl: activeLeague?.logoUrl || null,
    primaryColor: activeLeague?.primaryColor || null,
    secondaryColor: activeLeague?.secondaryColor || null,
  }).replace(/</g, '\\u003c');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(() => { try { const saved = localStorage.getItem('theme'); const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; const theme = saved || (prefersDark ? 'dark' : 'light'); const el = document.documentElement; el.setAttribute('data-theme', theme); el.style.setProperty('color-scheme', theme); } catch (e) {} })();` }} />
        <script dangerouslySetInnerHTML={{ __html: `window.__LEAGUE_CONFIG__ = ${leagueConfigJson};` }} />
        <script dangerouslySetInnerHTML={{ __html: `window.__LEAGUE_BRANDING__ = ${leagueBrandingJson};` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}>
        <Suspense fallback={null}><LeagueThemeScope /></Suspense>
        <TeamLogoProvider>
          <Suspense fallback={null}><UnifiedNavbar /></Suspense>
          <Suspense fallback={null}><GlobalLeagueSwitcher /></Suspense>
          <main className="flex-grow">{children}</main>
          <Footer />
        </TeamLogoProvider>
        <Analytics />
      </body>
    </html>
  );
}
