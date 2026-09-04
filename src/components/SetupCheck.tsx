'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import LandingPage from '@/components/LandingPage';

// Platform-level routes that must always render, regardless of whether any
// individual league has finished its setup wizard. This flag was written
// for the original single-league template, where "is setup complete" meant
// "is THE league ready" and it was fine to gate the whole site behind a
// landing page until then. LeagueZone is multi-tenant: a brand new,
// cookie-less visitor hitting /login, /register, or /app has no league
// context at all yet (that's the whole point of those pages), so the
// /api/setup/status fallback correctly can't resolve one — but that must
// never be interpreted as "nothing on this site is set up, show the
// marketing landing page instead of the login form".
const PLATFORM_ROUTE_PREFIXES = [
  '/setup',
  '/api',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/app',
  '/join',
  '/leagues',
  '/super-admin',
  '/features',
  '/pricing',
  '/demo',
  '/privacy',
  '/terms',
];

/**
 * Client component that checks if setup is complete.
 * If not, shows the landing page (unless already on a setup page).
 */
export default function SetupCheck({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [setupComplete, setSetupComplete] = useState(true); // Assume complete initially to avoid flash

  useEffect(() => {
    // Skip the check entirely on platform-level routes — they work the same
    // whether zero, one, or many leagues have completed setup.
    if (PLATFORM_ROUTE_PREFIXES.some((p) => pathname === p || pathname?.startsWith(p + '/'))) {
      setChecked(true);
      return;
    }

    async function checkSetup() {
      try {
        const res = await fetch('/api/setup/status');
        if (res.ok) {
          const data = await res.json();
          if (!data.setupCompleted) {
            setSetupComplete(false);
          }
        }
      } catch {
        // If API fails, assume setup is complete (don't block the site)
      }
      setChecked(true);
    }

    checkSetup();
  }, [pathname]);

  // Show loading while checking
  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
      </div>
    );
  }

  // Show landing page if setup not complete — but always let /setup pages through
  if (!setupComplete && !pathname?.startsWith('/setup')) {
    return <LandingPage />;
  }

  return <>{children}</>;
}
