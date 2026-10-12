'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { House, Menu, Search, Bookmark, ChartNoAxesCombined, X } from 'lucide-react';

type MobileLink = { href: string; label: string };

export default function LeagueMobileNav({ links }: { links: MobileLink[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (/\/draft\/(room|overlay)|\/admin(?:\/|$)|\/(login|register)(?:\/|$)/.test(pathname)) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="League navigation">
          <button className="absolute inset-0 bg-black/70" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <section className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface)] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.18em]">League menu</h2>
              <button className="rounded-lg border border-[var(--border)] p-2" onClick={() => setOpen(false)} aria-label="Close league menu"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event('leaguezone:open-saved')); }} className="rounded-xl border border-[var(--border)] bg-black/5 px-4 py-3 text-left text-sm font-bold">Saved Research</button>
              <Link href="/settings/notifications" className="rounded-xl border border-[var(--border)] bg-black/5 px-4 py-3 text-sm font-bold">Notifications</Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {links.map((link) => <Link key={link.href} href={link.href} className="rounded-xl border border-[var(--border)] bg-black/5 px-4 py-3 text-sm font-bold hover:border-[var(--accent)]">{link.label}</Link>)}
            </div>
          </section>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[var(--brand-navy)]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Mobile league navigation">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          <Link href={links.find((link) => link.label.toLowerCase() === 'home')?.href || '/'} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold text-white/75" aria-label="League home"><House className="h-5 w-5" />Home</Link>
          <Link href="/research" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold text-white/75"><ChartNoAxesCombined className="h-5 w-5" />Research</Link>
          <button type="button" onClick={() => window.dispatchEvent(new Event('leaguezone:open-search'))} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold text-white/75" aria-label="Search LeagueZone"><Search className="h-5 w-5" />Search</button>
          <Link href="/app" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold text-white/75"><Bookmark className="h-5 w-5" />My Leagues</Link>
          <button type="button" onClick={() => setOpen(true)} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold text-white/75" aria-expanded={open}><Menu className="h-5 w-5" />More</button>
        </div>
      </nav>
    </>
  );
}
