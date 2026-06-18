'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getTeamLogoPath } from '@/lib/utils/team-utils';
import { DefaultTeamHelmet } from './DefaultTeamHelmet';
import { useTeamLogos } from '@/contexts/TeamLogoContext';

/**
 * Renders a team's logo with layered fallbacks:
 *  1. DB-stored logoUrl override (set via settings)
 *  2. Static file at /assets/teams/logos/{name}.png
 *  3. Colored DefaultTeamHelmet SVG (color from DB helmetColorIndex or hash of name)
 */
export function TeamLogo({
  teamName,
  size = 48,
  className = '',
}: {
  teamName: string;
  size?: number;
  className?: string;
}) {
  const overrides = useTeamLogos();
  const override = overrides[teamName];
  const helmetColorIndex = override?.helmetColorIndex ?? undefined;
  const [failed, setFailed] = useState(false);

  const src = override?.logoUrl || (teamName ? getTeamLogoPath(teamName) : null);

  if (!teamName || failed || !src) {
    return (
      <DefaultTeamHelmet
        teamName={teamName || ''}
        size={size}
        className={className}
        colorIndex={helmetColorIndex}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={teamName}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
