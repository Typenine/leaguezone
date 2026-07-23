'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getNavigationSurface } from '@/lib/navigation/surfaces';

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

export default function LeagueThemeScope() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    const root = document.documentElement;
    const branding = (window as LeagueBrandingWindow).__LEAGUE_BRANDING__;
    const useLeagueTheme = getNavigationSurface(pathname) === 'legacy-league';
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
