import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LeagueZone HQ',
    short_name: 'LeagueZone',
    description: 'Your fantasy football leagues, teams, history, drafts, and matchups in one app.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#08111f',
    theme_color: '#08111f',
    lang: 'en-US',
    categories: ['sports', 'entertainment'],
    icons: [
      {
        src: '/assets/LeagueZone%20HQ%20Logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      { src: '/assets/LeagueZone%20HQ%20Logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
