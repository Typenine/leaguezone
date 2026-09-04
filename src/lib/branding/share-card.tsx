import React from 'react';
import { ImageResponse } from 'next/og';
import { deriveSemanticBrandTokens, normalizeBrandPalette } from '@/lib/branding/colors';

export type ShareCardKind = 'league' | 'matchup' | 'standings' | 'champion' | 'draft' | 'trade' | 'record' | 'power' | 'newsletter' | 'hall-of-fame';

export type ShareCardLeague = {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export function createLeagueShareCard(params: {
  league: ShareCardLeague;
  kind: ShareCardKind;
  title: string;
  subtitle?: string;
  left?: string;
  right?: string;
  footer?: string;
  origin: string;
}): ImageResponse {
  const palette = normalizeBrandPalette({
    primary: params.league.primaryColor || '#0b5f98',
    secondary: params.league.secondaryColor || '#be161e',
  }) || { primary: '#0b5f98', secondary: '#be161e' };
  const semantic = deriveSemanticBrandTokens(palette);
  const logo = params.league.logoUrl
    ? new URL(params.league.logoUrl, params.origin).toString()
    : null;
  const label = params.kind.replace(/-/g, ' ').toUpperCase();

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#08111f', color: 'white', padding: 54, fontFamily: 'Arial, sans-serif', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: `linear-gradient(135deg, ${semantic.accent}33, transparent 48%, ${semantic.secondaryAccent}2a)` }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, background: semantic.accent }} />
        <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, width: 6, background: semantic.secondaryAccent }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 84, height: 84, borderRadius: 18, background: '#ffffff12', border: '2px solid #ffffff22', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {logo ? <img src={logo} width="78" height="78" style={{ objectFit: 'contain' }} /> : <span style={{ fontSize: 28, fontWeight: 900, color: semantic.accent }}>{(params.league.shortName || params.league.name).slice(0, 4).toUpperCase()}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 28, fontWeight: 800 }}>{params.league.name}</span>
              <span style={{ fontSize: 18, letterSpacing: 3, color: '#ffffff99', marginTop: 4 }}>{label}</span>
            </div>
          </div>
          <div style={{ display: 'flex', borderRadius: 999, padding: '10px 18px', background: semantic.accent, color: semantic.onAccent, fontSize: 16, fontWeight: 900, letterSpacing: 2 }}>LEAGUEZONE</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, zIndex: 1, paddingTop: 26 }}>
          <div style={{ fontSize: params.title.length > 48 ? 48 : 62, lineHeight: 1.05, fontWeight: 900, maxWidth: 1060 }}>{params.title}</div>
          {params.subtitle ? <div style={{ fontSize: 26, color: '#dbe6ff', marginTop: 20, maxWidth: 1000, lineHeight: 1.25 }}>{params.subtitle}</div> : null}
          {(params.left || params.right) ? (
            <div style={{ display: 'flex', gap: 22, marginTop: 34 }}>
              {params.left ? <div style={{ display: 'flex', flex: 1, minHeight: 94, padding: '22px 26px', borderRadius: 18, background: '#ffffff0d', border: `2px solid ${semantic.accent}88`, fontSize: 26, fontWeight: 800, alignItems: 'center' }}>{params.left}</div> : null}
              {params.right ? <div style={{ display: 'flex', flex: 1, minHeight: 94, padding: '22px 26px', borderRadius: 18, background: '#ffffff0d', border: `2px solid ${semantic.secondaryAccent}88`, fontSize: 26, fontWeight: 800, alignItems: 'center' }}>{params.right}</div> : null}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1, color: '#ffffff99', fontSize: 18 }}>
          <span>{params.footer || 'LeagueZone fantasy league site'}</span>
          <div style={{ display: 'flex', gap: 8 }}><span style={{ width: 42, height: 6, borderRadius: 6, background: semantic.accent }} /><span style={{ width: 42, height: 6, borderRadius: 6, background: semantic.secondaryAccent }} /></div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
