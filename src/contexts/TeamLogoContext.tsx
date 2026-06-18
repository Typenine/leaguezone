'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type TeamLogoOverride = {
  logoUrl: string | null;
  helmetColorIndex: number | null;
};

type TeamLogoMap = Record<string, TeamLogoOverride>;

const TeamLogoContext = createContext<TeamLogoMap>({});

export function TeamLogoProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<TeamLogoMap>({});

  useEffect(() => {
    fetch('/api/team-logos')
      .then(r => (r.ok ? r.json() : {}))
      .then((data: TeamLogoMap) => setOverrides(data))
      .catch(() => {});
  }, []);

  return (
    <TeamLogoContext.Provider value={overrides}>
      {children}
    </TeamLogoContext.Provider>
  );
}

export function useTeamLogos(): TeamLogoMap {
  return useContext(TeamLogoContext);
}
