'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type TeamBrandingOverride = {
  logoUrl: string | null;
  helmetColorIndex: number | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  tertiaryColor?: string | null;
  quaternaryColor?: string | null;
};

export type TeamLogoOverride = TeamBrandingOverride;

type TeamBrandingMap = Record<string, TeamBrandingOverride>;

const TeamLogoContext = createContext<TeamBrandingMap>({});

export function TeamLogoProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<TeamBrandingMap>({});

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch('/api/team-logos', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : {}))
        .then((data: TeamBrandingMap) => {
          if (!cancelled) setOverrides(data);
        })
        .catch(() => {});
    };

    load();
    const onLeagueChanged = () => load();
    window.addEventListener('leaguezone:league-changed', onLeagueChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('leaguezone:league-changed', onLeagueChanged);
    };
  }, []);

  return (
    <TeamLogoContext.Provider value={overrides}>
      {children}
    </TeamLogoContext.Provider>
  );
}

/** Backward-compatible name used by existing logo consumers. */
export function useTeamLogos(): TeamBrandingMap {
  return useContext(TeamLogoContext);
}

export function useTeamBranding(): TeamBrandingMap {
  return useContext(TeamLogoContext);
}
