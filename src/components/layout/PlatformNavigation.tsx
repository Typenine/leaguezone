'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { getPlatformNavigationSection, PLATFORM_NAV } from '@/lib/navigation/platform';

export function PlatformDesktopNav() {
  const pathname = usePathname() || '/';
  const current = getPlatformNavigationSection(pathname);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    navRef.current?.querySelectorAll('details[open]').forEach(item => { (item as HTMLDetailsElement).open = false; });
  }, [pathname]);

  useEffect(() => {
    const closeMenus = () => navRef.current?.querySelectorAll('details[open]').forEach(item => { (item as HTMLDetailsElement).open = false; });
    const outside = (event: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) closeMenus();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMenus(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  return <nav ref={navRef} aria-label="LeagueZone navigation" className="flex items-center gap-0.5">
    {PLATFORM_NAV.map(section => section.links.length === 0
      ? <Link key={section.id} href={section.href} aria-current={current === section.id ? 'page' : undefined}
          className={`lz-platform-top-link ${current === section.id ? 'lz-platform-current' : ''}`}>{section.label}</Link>
      : <details key={section.id} className={`lz-platform-group ${section.id === 'tools' ? 'lz-platform-wide' : ''} ${section.id === 'hub' || section.id === 'demo' ? 'lz-platform-align-right' : ''}`}>
          <summary className={`lz-platform-top-link ${current === section.id ? 'lz-platform-current' : ''}`}
            aria-label={section.label + ' menu'}>{section.label}<ChevronDown aria-hidden="true" size={14} /></summary>
          <div className="lz-platform-dropdown" aria-label={section.label + ' links'}>
            {section.links.map(link => <Link key={link.href} href={link.href}
              aria-current={pathname === link.href.split('?')[0] ? 'page' : undefined}
              onClick={(event) => { const details = event.currentTarget.closest('details'); if (details) details.open = false; }}
              className="lz-platform-dropdown-link">{link.label}</Link>)}
          </div>
        </details>)}
  </nav>;
}

export function PlatformMobileMenu({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname() || '/';
  const current = getPlatformNavigationSection(pathname);
  return <nav aria-label="LeagueZone sections" className="space-y-1">
    {PLATFORM_NAV.map(section => section.links.length === 0
      ? <Link key={section.id} href={section.href} onClick={onNavigate}
          aria-current={current === section.id ? 'page' : undefined}
          className="block rounded-lg px-3 py-3 text-sm font-bold text-[var(--text)] hover:bg-[var(--surface-strong)]">{section.label}</Link>
      : <details key={section.id} className="group rounded-lg border border-[var(--border)]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 py-3 text-sm font-bold text-[var(--text)] [&::-webkit-details-marker]:hidden">
            <span>{section.label}</span><ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true"/>
          </summary>
          <div className="space-y-0.5 border-t border-[var(--border)] p-1.5">
            {section.links.map(link => <Link key={link.href} href={link.href} onClick={onNavigate}
              aria-current={pathname === link.href.split('?')[0] ? 'page' : undefined}
              className="block rounded-md px-3 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">{link.label}</Link>)}
          </div>
        </details>)}
  </nav>;
}
