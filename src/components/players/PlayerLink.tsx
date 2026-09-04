"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnchorHTMLAttributes, MouseEvent } from 'react';
import { usePlayerModal } from '@/components/players/PlayerModalContext';
import { getLeagueBasePath } from '@/lib/utils/league-route';

export type PlayerLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /** Sleeper player id, the canonical, roster/name-independent identifier. */
  playerId: string;
  /** Display name (or any node) to render as the link's contents. */
  children: React.ReactNode;
  /** When true, renders plain text (no link), useful when playerId is unknown/missing. */
  disabled?: boolean;
};

/**
 * Shared, lightweight link to a player's canonical profile.
 * Preserves /l/[leagueSlug] when used inside a hosted league so modifier-clicks,
 * new tabs, and no-modal navigation cannot silently fall back to another league.
 */
export default function PlayerLink({ playerId, children, disabled, className, onClick, ...props }: PlayerLinkProps) {
  const modal = usePlayerModal();
  const pathname = usePathname();
  const leagueBase = getLeagueBasePath(pathname);

  if (disabled || !playerId) {
    return <span className={className}>{children}</span>;
  }

  const classes = ['hover:underline underline-offset-2', className].filter(Boolean).join(' ');
  const profileHref = `${leagueBase}/players/${encodeURIComponent(playerId)}`;

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || !modal) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    modal.openPlayer(playerId, typeof children === 'string' ? children : undefined);
  };

  return (
    <Link href={profileHref} className={classes} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
