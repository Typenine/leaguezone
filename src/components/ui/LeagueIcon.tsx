import type { SVGProps } from 'react';

export type LeagueIconName =
  | 'command'
  | 'history'
  | 'data'
  | 'commissioner'
  | 'draft'
  | 'trophy'
  | 'trade'
  | 'managers';

const paths: Record<LeagueIconName, string[]> = {
  command: [
    'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z',
    'M8 8h8M8 12h4M8 16h6',
  ],
  history: [
    'M12 5a7 7 0 1 1-6.1 3.56',
    'M5 5v4h4',
    'M12 8v4l3 2',
  ],
  data: [
    'M5 18V9M12 18V5M19 18v-7',
    'M4 18h16',
  ],
  commissioner: [
    'M12 4l7 3v5c0 4.2-2.9 6.8-7 8-4.1-1.2-7-3.8-7-8V7l7-3Z',
    'M9 12l2 2 4-5',
  ],
  draft: [
    'M7 4h10v16H7V4Z',
    'M9.5 8h5M9.5 12h5M9.5 16H12',
  ],
  trophy: [
    'M8 5h8v3a4 4 0 0 1-8 0V5Z',
    'M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3',
    'M12 12v4M9 20h6M10 16h4',
  ],
  trade: [
    'M7 7h10l-3-3M17 17H7l3 3',
    'M7 7l3 3M17 17l-3-3',
  ],
  managers: [
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 10a2.5 2.5 0 1 0 0-5',
    'M4 20a5 5 0 0 1 10 0M13.5 15.5A4.5 4.5 0 0 1 20 20',
  ],
};

export function LeagueIcon({
  name,
  className = '',
  ...props
}: SVGProps<SVGSVGElement> & { name: LeagueIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export default LeagueIcon;
