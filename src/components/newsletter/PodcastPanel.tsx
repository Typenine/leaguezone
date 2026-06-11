'use client';

import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import LinkButton from '@/components/ui/LinkButton';
import { Tabs } from '@/components/ui/Tabs';

export type PodcastConfig = {
  spotifyUrl: string;
  spotifyEmbedUrl: string;
  appleUrl: string;
  appleEmbedUrl: string;
  rssFeedUrl: string;
};

export default function PodcastPanel({ podcast }: { podcast: PodcastConfig }) {
  const hasSpotify = !!podcast.spotifyEmbedUrl;
  const hasApple = !!podcast.appleEmbedUrl;

  if (!hasSpotify && !hasApple) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="text-5xl mb-4">🎙️</div>
          <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Podcast Coming Soon</h2>
          <p className="text-[var(--muted)] max-w-md mx-auto">
            The league podcast has not been connected yet. Check back later for Spotify and Apple Podcasts links.
          </p>
          {podcast.rssFeedUrl && (
            <p className="text-xs text-[var(--muted)] mt-4">
              RSS feed configured for future episode sync.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const tabs = [];
  if (hasSpotify) {
    tabs.push({
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
                src={podcast.spotifyEmbedUrl}
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
            {podcast.spotifyUrl && (
              <LinkButton href={podcast.spotifyUrl} target="_blank" rel="noopener noreferrer" variant="primary">
                Open on Spotify
              </LinkButton>
            )}
          </CardFooter>
        </Card>
      ),
    });
  }
  if (hasApple) {
    tabs.push({
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
                src={podcast.appleEmbedUrl}
                loading="lazy"
              />
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <span className="text-[var(--muted)] text-sm">Opens in Apple Podcasts</span>
            {podcast.appleUrl && (
              <LinkButton href={podcast.appleUrl} target="_blank" rel="noopener noreferrer" variant="primary">
                Open on Apple Podcasts
              </LinkButton>
            )}
          </CardFooter>
        </Card>
      ),
    });
  }

  return (
    <div>
      <p className="text-[var(--muted)] mb-4">
        League talk, matchup previews, trades, and weekly storylines. Choose your platform below to listen.
      </p>
      <Tabs initialId={tabs[0]?.id} tabs={tabs} />
      {podcast.rssFeedUrl && (
        <p className="text-xs text-[var(--muted)] mt-4">
          RSS feed saved for future transcription and episode sync features.
        </p>
      )}
    </div>
  );
}
