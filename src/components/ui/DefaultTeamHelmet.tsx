/**
 * Default football helmet shown when a team has no uploaded logo.
 * Color is derived deterministically from the team name so the same team
 * always gets the same helmet across page loads.
 */

export const HELMET_PALETTE = [
  { label: 'Black',       file: 'black football helmet.png',       color: '#333333' },
  { label: 'Brown',       file: 'brown football helmet.png',       color: '#7b4f2e' },
  { label: 'Gold',        file: 'gold football helmet.png',        color: '#c5a028' },
  { label: 'Green',       file: 'green football helmet.png',       color: '#2d8a2d' },
  { label: 'Lime Green',  file: 'lime green football helmet.png',  color: '#6abf1e' },
  { label: 'Maroon',      file: 'maroon football helmet.png',      color: '#7b1c2e' },
  { label: 'Navy',        file: 'navy football helmet.png',        color: '#1a2a6b' },
  { label: 'Orange',      file: 'orange football helmet.png',      color: '#e07020' },
  { label: 'Pink',        file: 'pink football helmet.png',        color: '#d45f8a' },
  { label: 'Powder Blue', file: 'powder blue football helmet.png', color: '#5aaddb' },
  { label: 'Purple',      file: 'purple football helmet.png',      color: '#6b2fa0' },
  { label: 'Red',         file: 'red football helmet.png',         color: '#c0392b' },
  { label: 'Silver',      file: 'silver football helmet.png',      color: '#909090' },
  { label: 'Teal',        file: 'teal football helmet.png',        color: '#148f77' },
  { label: 'Yellow',      file: 'yellow football helmet.png',      color: '#e0c020' },
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
  colorIndex,
}: {
  teamName: string;
  size?: number;
  className?: string;
  colorIndex?: number;
}) {
  const idx = colorIndex !== undefined
    ? Math.abs(colorIndex) % HELMET_PALETTE.length
    : hashTeamName(teamName || 'default') % HELMET_PALETTE.length;
  const { file, label } = HELMET_PALETTE[idx];
  const src = `/assets/default%20logos/${encodeURIComponent(file)}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={teamName ? `${teamName} helmet` : `${label} helmet`}
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}
