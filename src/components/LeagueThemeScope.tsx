'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

type LeagueBrandingWindow = typeof window & {
  __LEAGUE_BRANDING__?: {
    primaryColor?: string | null;
    secondaryColor?: string | null;
  };
};

const WEBSITE_TOKENS = {
  accent: 'var(--brand-blue)',
  gold: 'var(--brand-gold)',
};

function shouldUseLeagueTheme(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname.startsWith('/leagues/')) return false;
  // League sites under /l/ apply their own colors in the league layout,
  // scoped to the league resolved from the route slug (not the cookie).
  if (pathname.startsWith('/l/')) return false;
  if (pathname === '/features' || pathname === '/pricing' || pathname === '/demo') return false;
  if (pathname === '/app' || pathname.startsWith('/app/')) return false;
  if (pathname.startsWith('/setup')) return false;
  if (pathname.startsWith('/join/')) return false;
  if (pathname.startsWith('/login')) return false;
  if (pathname.startsWith('/register')) return false;
  if (pathname.startsWith('/forgot-password')) return false;
  if (pathname.startsWith('/reset-password')) return false;
  if (pathname.startsWith('/verify-email')) return false;
  if (pathname.startsWith('/super-admin')) return false;
  return true;
}

export default function LeagueThemeScope() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const branding = (window as LeagueBrandingWindow).__LEAGUE_BRANDING__;
    const useLeagueTheme = shouldUseLeagueTheme(pathname || '');
    const primary = branding?.primaryColor || null;
    const secondary = branding?.secondaryColor || null;

    if (useLeagueTheme && primary) {
      root.style.setProperty('--accent', primary);
      root.style.setProperty('--focus', primary);
      root.style.setProperty('--league-accent', primary);
    } else {
      root.style.setProperty('--accent', WEBSITE_TOKENS.accent);
      root.style.setProperty('--focus', WEBSITE_TOKENS.accent);
      root.style.removeProperty('--league-accent');
    }

    if (useLeagueTheme && secondary) {
      root.style.setProperty('--gold', secondary);
      root.style.setProperty('--league-gold', secondary);
    } else {
      root.style.setProperty('--gold', WEBSITE_TOKENS.gold);
      root.style.removeProperty('--league-gold');
    }
  }, [pathname]);

  return null;
}
