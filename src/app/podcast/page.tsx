import type { Metadata } from 'next';
import SectionHeader from '@/components/ui/SectionHeader';
import LinkButton from '@/components/ui/LinkButton';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';

export const metadata: Metadata = {
  title: 'Podcast • Fantasy Football League',
  description: 'Listen to the fantasy football league podcast.',
};

// TODO: Update these URLs with your league's actual podcast links after setup.
const SPOTIFY_SHOW_URL = process.env.PODCAST_SPOTIFY_URL || 'https://open.spotify.com';
const SPOTIFY_EMBED_URL = process.env.PODCAST_SPOTIFY_EMBED_URL || '';

const APPLE_PODCAST_URL = process.env.PODCAST_APPLE_URL || 'https://podcasts.apple.com';
const APPLE_EMBED_URL = process.env.PODCAST_APPLE_EMBED_URL || '';

export default function PodcastPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <SectionHeader title="League Podcast" className="mx-auto max-w-fit" />
        <p className="text-[var(--muted)] mt-2">
          League talk, matchup previews, trades, and weekly storylines. Choose your platform below to listen.
        </p>
      </div>

      <Tabs
        initialId="spotify"
        tabs={[
          {
            id: 'spotify',
            label: 'Spotify',
            content: (
              <Card className="hover-lift">
                <CardHeader>
                  <CardTitle>Listen on Spotify</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-full">
                    <iframe
                      title="Spotify show embed"
                      src={SPOTIFY_EMBED_URL}
                      width="100%"
                      height="360"
                      style={{ border: 0, borderRadius: '12px' }}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <span className="text-[var(--muted)] text-sm">Opens in Spotify</span>
                  <LinkButton href={SPOTIFY_SHOW_URL} target="_blank" rel="noopener noreferrer" variant="primary">
                    Open on Spotify
                  </LinkButton>
                </CardFooter>
              </Card>
            ),
          },
          {
            id: 'apple',
            label: 'Apple Podcasts',
            content: (
              <Card className="hover-lift">
                <CardHeader>
                  <CardTitle>Listen on Apple Podcasts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-full">
                    <iframe
                      allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
                      frameBorder="0"
                      height="450"
                      style={{ width: '100%', overflow: 'hidden', background: 'transparent', borderRadius: '12px' }}
                      sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
                      title="Apple Podcasts show embed"
                      src={APPLE_EMBED_URL}
                      loading="lazy"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <span className="text-[var(--muted)] text-sm">Opens in Apple Podcasts</span>
                  <LinkButton href={APPLE_PODCAST_URL} target="_blank" rel="noopener noreferrer" variant="primary">
                    Open on Apple Podcasts
                  </LinkButton>
                </CardFooter>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
