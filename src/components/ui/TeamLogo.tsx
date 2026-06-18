'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getTeamLogoPath } from '@/lib/utils/team-utils';
import { DefaultTeamHelmet } from './DefaultTeamHelmet';

/**
 * Renders a team's uploaded logo, falling back to a colored helmet SVG when
 * the image is missing or fails to load. Drop-in replacement for the raw
 * <Image src={getTeamLogoPath(...)} onError={...} /> pattern.
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
  const [failed, setFailed] = useState(false);

  if (!teamName || failed) {
    return (
      <DefaultTeamHelmet
        teamName={teamName || ''}
        size={size}
        className={className}
      />
    );
  }

  return (
    <Image
      src={getTeamLogoPath(teamName)}
      alt={teamName}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
