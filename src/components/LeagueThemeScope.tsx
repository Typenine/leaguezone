'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getNavigationSurface } from '@/lib/navigation/surfaces';
import { getReadableTextColor, normalizeHexColor } from '@/lib/branding/colors';

type LeagueBrandingWindow = typeof window & {
  __LEAGUE_BRANDING__?: {
    primaryColor?: string | null;
    secondaryColor?: string | null;
  };
};

const WEBSITE_TOKENS = {
  accent: 'var(--brand-blue)',
  accentText: '#ffffff',
  gold: 'var(--brand-gold)',
  goldText: '#111827',
};

export default function LeagueThemeScope() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    const root = document.documentElement;
    const branding = (window as LeagueBrandingWindow).__LEAGUE_BRANDING__;
    const useLeagueTheme = getNavigationSurface(pathname) === 'legacy-league';
    const primary = normalizeHexColor(branding?.primaryColor);
    const secondary = normalizeHexColor(branding?.secondaryColor);

    if (useLeagueTheme && primary) {
      root.style.setProperty('--accent', primary);
      root.style.setProperty('--focus', primary);
      root.style.setProperty('--league-accent', primary);
      root.style.setProperty('--on-accent', getReadableTextColor(primary));
    } else {
      root.style.setProperty('--accent', WEBSITE_TOKENS.accent);
      root.style.setProperty('--focus', WEBSITE_TOKENS.accent);
      root.style.setProperty('--on-accent', WEBSITE_TOKENS.accentText);
      root.style.removeProperty('--league-accent');
    }

    if (useLeagueTheme && secondary) {
      root.style.setProperty('--gold', secondary);
      root.style.setProperty('--league-gold', secondary);
      root.style.setProperty('--on-gold', getReadableTextColor(secondary));
    } else {
      root.style.setProperty('--gold', WEBSITE_TOKENS.gold);
      root.style.setProperty('--on-gold', WEBSITE_TOKENS.goldText);
      root.style.removeProperty('--league-gold');
    }
  }, [pathname]);

  return null;
}
