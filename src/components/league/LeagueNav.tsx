'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type LeagueNavLink = {
  href: string;
  label: string;
};

/**
 * Horizontal tab navigation for league sites (/l/[leagueSlug]).
 * Receives pre-filtered, feature-aware links from the server layout.
 */
export default function LeagueNav({ links, accent }: { links: LeagueNavLink[]; accent?: string | null }) {
  const pathname = usePathname();

  return (
    <nav aria-label="League navigation" className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          {links.map((link) => {
            const isHome = link.href.split('/').length <= 3;
            const active = isHome
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  active
                    ? 'text-white'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]'
                }`}
                style={active ? { backgroundColor: accent || 'var(--accent)' } : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
