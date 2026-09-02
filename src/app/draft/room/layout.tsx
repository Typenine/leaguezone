'use client';

import { useEffect, useState, type ReactNode } from 'react';
import DraftRoomClosed from '@/components/draft/DraftRoomClosed';

type MeResp = {
  authenticated: boolean;
  isAdmin?: boolean;
  claims?: { team?: string };
};

type Lifecycle = { state: 'scheduled' | 'open' | 'paused' | 'complete' | 'archived'; date?: string | null; location?: string | null };

export default function DraftRoomLayout({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResp | null>(null);
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/draft/lifecycle', { cache: 'no-store' }).then((r) => r.ok ? r.json() : ({ state: 'scheduled' })),
    ]).then(([auth, draft]) => { if (mounted) { setMe(auth as MeResp); setLifecycle(draft as Lifecycle); } }).catch(() => { if (mounted) { setMe({ authenticated: false }); setLifecycle({ state: 'scheduled' }); } });
    return () => {
      mounted = false;
    };
  }, []);

  if (!me || !lifecycle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (!me.isAdmin && lifecycle.state !== 'open') {
    return <DraftRoomClosed date={lifecycle.date} location={lifecycle.location} />;
  }

  return children;
}
