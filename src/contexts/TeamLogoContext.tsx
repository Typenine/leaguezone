'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { deriveSemanticBrandTokens, getReadableTextColor, normalizeBrandPalette, normalizeHexColor } from '@/lib/branding/colors';
import { getReadableTextForColors, getTeamBrandCssKey } from '@/lib/utils/team-utils';

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

type ColorSlot = 'primary' | 'secondary' | 'tertiary' | 'quaternary';
const COLOR_SLOTS: ColorSlot[] = ['primary', 'secondary', 'tertiary', 'quaternary'];

const TeamLogoContext = createContext<TeamBrandingMap>({});

function clearTeamBrandingVariables(keys: string[]) {
  const root = document.documentElement;
  for (const key of keys) {
    for (const slot of COLOR_SLOTS) {
      root.style.removeProperty(`--team-brand-${key}-${slot}`);
      root.style.removeProperty(`--team-brand-${key}-${slot}-text`);
    }
    root.style.removeProperty(`--team-brand-${key}-gradient-text`);
    root.style.removeProperty(`--team-brand-${key}-accent`);
    root.style.removeProperty(`--team-brand-${key}-secondary-accent`);
    root.style.removeProperty(`--team-brand-${key}-highlight`);
    root.style.removeProperty(`--team-brand-${key}-border-highlight`);
  }
}

function applyTeamBrandingVariables(data: TeamBrandingMap): string[] {
  const root = document.documentElement;
  const keys: string[] = [];

  for (const [teamName, branding] of Object.entries(data)) {
    const key = getTeamBrandCssKey(teamName);
    keys.push(key);
    const palette: Record<ColorSlot, string | null> = {
      primary: normalizeHexColor(branding.primaryColor),
      secondary: normalizeHexColor(branding.secondaryColor),
      tertiary: normalizeHexColor(branding.tertiaryColor),
      quaternary: normalizeHexColor(branding.quaternaryColor),
    };

    for (const slot of COLOR_SLOTS) {
      const color = palette[slot];
      if (!color) continue;
      root.style.setProperty(`--team-brand-${key}-${slot}`, color);
      root.style.setProperty(`--team-brand-${key}-${slot}-text`, getReadableTextColor(color));
    }

    const normalizedPalette = normalizeBrandPalette({
      primary: palette.primary,
      secondary: palette.secondary,
      tertiary: palette.tertiary,
      quaternary: palette.quaternary,
    });
    if (normalizedPalette) {
      const semantic = deriveSemanticBrandTokens(normalizedPalette);
      root.style.setProperty(`--team-brand-${key}-accent`, semantic.accent);
      root.style.setProperty(`--team-brand-${key}-secondary-accent`, semantic.secondaryAccent);
      root.style.setProperty(`--team-brand-${key}-highlight`, semantic.highlight);
      root.style.setProperty(`--team-brand-${key}-border-highlight`, semantic.borderHighlight);
    }

    const gradientColors = [palette.primary, palette.secondary].filter((color): color is string => Boolean(color));
    if (gradientColors.length) {
      root.style.setProperty(`--team-brand-${key}-gradient-text`, getReadableTextForColors(gradientColors));
    }
  }

  return keys;
}

function legacyTeamBrandingCss(data: TeamBrandingMap): string {
  return Object.keys(data).map((teamName) => {
    const key = getTeamBrandCssKey(teamName);
    return `
      [style*="--accent: var(--team-brand-${key}-primary"] {
        --on-accent: var(--team-brand-${key}-primary-text, #ffffff);
      }
      [style*="linear-gradient"][style*="--team-brand-${key}-"] > h1,
      [style*="linear-gradient"][style*="--team-brand-${key}-"] > h2,
      [style*="linear-gradient"][style*="--team-brand-${key}-"] > h3,
      [style*="linear-gradient"][style*="--team-brand-${key}-"] > h4,
      [style*="linear-gradient"][style*="--team-brand-${key}-"] > h5,
      [style*="linear-gradient"][style*="--team-brand-${key}-"] > h6 {
        width: fit-content;
        max-width: 100%;
        border-radius: 0.25rem;
        background: var(--surface);
        color: var(--text) !important;
        padding: 0.08rem 0.35rem;
      }
    `;
  }).join('\n');
}

function detectSeason(pathname: string): string | null {
  const querySeason = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('season') : null;
  if (querySeason && /^20\d{2}$/.test(querySeason)) return querySeason;
  const match = pathname.match(/(?:^|\/)(20\d{2})(?:\/|$)/);
  return match?.[1] || null;
}

export function TeamLogoProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [overrides, setOverrides] = useState<TeamBrandingMap>({});
  const appliedKeys = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      const season = detectSeason(pathname || '');
      const url = season ? `/api/team-logos?season=${encodeURIComponent(season)}` : '/api/team-logos';
      fetch(url, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : {}))
        .then((data: TeamBrandingMap) => {
          if (cancelled) return;
          clearTeamBrandingVariables(appliedKeys.current);
          appliedKeys.current = applyTeamBrandingVariables(data);
          setOverrides(data);
        })
        .catch(() => {});
    };

    load();
    const onLeagueChanged = () => load();
    window.addEventListener('leaguezone:league-changed', onLeagueChanged);
    return () => {
      cancelled = true;
      clearTeamBrandingVariables(appliedKeys.current);
      window.removeEventListener('leaguezone:league-changed', onLeagueChanged);
    };
  }, [pathname]);

  return (
    <TeamLogoContext.Provider value={overrides}>
      {Object.keys(overrides).length > 0 ? <style>{legacyTeamBrandingCss(overrides)}</style> : null}
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
