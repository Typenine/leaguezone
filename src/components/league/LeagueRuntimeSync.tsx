'use client';

import { useLayoutEffect } from 'react';

type RuntimeConfig = {
  currentLeagueId: string;
  currentSeason: string;
  previousLeagueIds: Record<string, string>;
  franchiseNamesByOwnerId: Record<string, string>;
};

type RuntimeBranding = {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

type RuntimeWindow = typeof window & {
  __LEAGUE_CONFIG__?: RuntimeConfig;
  __LEAGUE_BRANDING__?: RuntimeBranding;
};

export default function LeagueRuntimeSync({
  leagueId,
  config,
  branding,
}: {
  leagueId: string;
  config: RuntimeConfig;
  branding: RuntimeBranding;
}) {
  useLayoutEffect(() => {
    const runtimeWindow = window as RuntimeWindow;
    runtimeWindow.__LEAGUE_CONFIG__ = config;
    runtimeWindow.__LEAGUE_BRANDING__ = branding;
    document.cookie = `active_league_id=${encodeURIComponent(leagueId)}; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    window.dispatchEvent(new Event('leaguezone:league-changed'));
  }, [branding, config, leagueId]);

  return null;
}
