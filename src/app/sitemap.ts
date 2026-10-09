import type { MetadataRoute } from 'next';

// Only public routes belong here. Private leagues and player details are not listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.leaguezonehq.com';
  return [
    { url: base + '/', changeFrequency: 'weekly', priority: 1 },
    { url: base + '/research', changeFrequency: 'weekly', priority: 0.9 },
    { url: base + '/research/stats', changeFrequency: 'weekly', priority: 0.9 },
    { url: base + '/research/players', changeFrequency: 'weekly', priority: 0.9 },
    { url: base + '/features', changeFrequency: 'monthly', priority: 0.5 },
    { url: base + '/pricing', changeFrequency: 'monthly', priority: 0.5 },
  ];
}
