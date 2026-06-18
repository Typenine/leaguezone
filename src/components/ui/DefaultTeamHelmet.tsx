/**
 * Default football helmet SVG shown when a team has no uploaded logo.
 * Color is derived deterministically from the team name so the same team
 * always gets the same helmet color across page loads.
 */

const HELMET_PALETTE = [
  { shell: '#c0392b', dark: '#922b21' }, // crimson
  { shell: '#2471a3', dark: '#1a5276' }, // navy
  { shell: '#1e8449', dark: '#155d32' }, // forest green
  { shell: '#7d3c98', dark: '#5b2c6f' }, // purple
  { shell: '#ca6f1e', dark: '#9a5216' }, // burnt orange
  { shell: '#148f77', dark: '#0e6655' }, // teal
  { shell: '#b7950b', dark: '#8a6f08' }, // gold
] as const;

function hashTeamName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function DefaultTeamHelmet({
  teamName,
  size = 48,
  className = '',
}: {
  teamName: string;
  size?: number;
  className?: string;
}) {
  const idx = hashTeamName(teamName || 'default') % HELMET_PALETTE.length;
  const { shell, dark } = HELMET_PALETTE[idx];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={teamName ? `${teamName} helmet` : 'Team helmet'}
      className={className}
    >
      {/* Helmet dome */}
      <path
        d="M20 78 C16 62 14 46 18 32 C22 18 36 10 56 10 C76 10 88 24 88 50 C88 70 78 82 62 84 Q40 88 20 78 Z"
        fill={shell}
      />
      {/* Bottom rim */}
      <path
        d="M18 76 Q40 90 64 84"
        stroke={dark}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      {/* Ear hole */}
      <ellipse cx="74" cy="56" rx="8" ry="10" fill={dark} />
      {/* Facemask backing shadow */}
      <path
        d="M14 44 C12 60 14 74 20 80"
        fill={dark}
      />
      {/* Facemask vertical bars */}
      <path d="M8 48 C6 62 8 76 14 82" stroke="#a0a0a0" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M15 45 C13 59 15 73 21 79" stroke="#a0a0a0" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Facemask horizontal connectors */}
      <path d="M7 58 Q18 56 22 57" stroke="#a0a0a0" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M7 69 Q18 67 22 68" stroke="#a0a0a0" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      {/* Dome highlight */}
      <path
        d="M26 20 C40 12 66 14 76 24 C62 15 40 15 26 20 Z"
        fill="white"
        opacity="0.22"
      />
    </svg>
  );
}
