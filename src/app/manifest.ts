import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'LeagueZone HQ',
    short_name: 'LeagueZone',
    description: 'Research fantasy football players and run your leagues, all from one home-screen app.',
    // Signed-in middleware normally rewrites / to /app. Installed app opens
    // the all-in-one homepage so Research and My Leagues are both accessible.
    start_url: '/?view=public',
    scope: '/',
    display: 'standalone',
    background_color: '#08111f',
    theme_color: '#08111f',
    lang: 'en-US',
    categories: ['sports', 'entertainment'],
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // The full-bleed navy backing keeps the LZ mark in Android's central maskable safe area.
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Player Research',
        short_name: 'Research',
        description: 'Player stats, usage, and development research.',
        url: '/research',
        icons: [{ src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'My Leagues',
        short_name: 'My Leagues',
        description: 'Open your league websites and commissioner tools.',
        url: '/app',
        icons: [{ src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
