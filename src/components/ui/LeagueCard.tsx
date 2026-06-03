import Link from 'next/link';
import type { ReactNode } from 'react';
import LeagueIcon, { type LeagueIconName } from './LeagueIcon';

type LeagueCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  metric?: string;
  icon?: LeagueIconName;
  href?: string;
  children?: ReactNode;
  className?: string;
};

function LeagueCardContent({ eyebrow, title, description, metric, icon, children }: LeagueCardProps) {
  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h3 className="mt-2 text-2xl font-black leading-tight tracking-[-0.04em] text-[var(--text)]">{title}</h3>
        </div>
        {icon && (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--accent)]">
            <LeagueIcon name={icon} className="h-6 w-6" />
          </span>
        )}
      </div>
      {metric && <p className="mb-3 font-mono text-4xl font-black tracking-[-0.06em] text-[var(--gold)]">{metric}</p>}
      {description && <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>}
      {children}
    </>
  );
}

export function LeagueCard(props: LeagueCardProps) {
  const className = ['league-card block p-6', props.className].filter(Boolean).join(' ');

  if (props.href) {
    return (
      <Link href={props.href} className={className}>
        <LeagueCardContent {...props} />
      </Link>
    );
  }

  return (
    <div className={className}>
      <LeagueCardContent {...props} />
    </div>
  );
}

export default LeagueCard;
