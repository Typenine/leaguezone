'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export type LeagueNavLink = {
  id: string;
  href?: string;
  label: string;
  children?: LeagueNavLink[];
};

const CLOSE_DELAY_MS = 350;

function isLinkActive(pathname: string, link: LeagueNavLink): boolean {
  if (link.href) {
    const active = link.id === 'home'
      ? pathname === link.href
      : pathname === link.href || pathname.startsWith(`${link.href}/`);
    if (active) return true;
  }
  return (link.children || []).some((child) => isLinkActive(pathname, child));
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 opacity-65 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function LeagueNav({ links, accent }: { links: LeagueNavLink[]; accent?: string | null }) {
  const pathname = usePathname() || '/';
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState<string | null>(null);
  const [desktopMenuPinned, setDesktopMenuPinned] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({});
  const resolvedAccent = accent || 'var(--brand-blue)';

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const closeDesktopMenus = () => {
    cancelClose();
    setDesktopMenuOpen(null);
    setDesktopMenuPinned(null);
  };

  const openDesktopMenu = (id: string) => {
    cancelClose();
    setDesktopMenuOpen(id);
  };

  const scheduleClose = (id: string) => {
    if (desktopMenuPinned === id) return;
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setDesktopMenuOpen((current) => (current === id ? null : current));
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  };

  const toggleDesktopMenu = (id: string) => {
    if (desktopMenuOpen === id && desktopMenuPinned === id) {
      closeDesktopMenus();
      return;
    }
    setDesktopMenuPinned(id);
    openDesktopMenu(id);
  };

  useEffect(() => {
    closeDesktopMenus();
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!desktopMenuRef.current?.contains(event.target as Node)) closeDesktopMenus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDesktopMenus();
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      cancelClose();
    };
  });

  return (
    <nav
      aria-label="League navigation"
      style={{ background: 'var(--brand-navy)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="container mx-auto px-4">
        <div
          ref={desktopMenuRef}
          className="hidden min-h-14 items-center gap-1 lg:flex"
          onMouseEnter={cancelClose}
          onMouseLeave={() => {
            if (desktopMenuOpen) scheduleClose(desktopMenuOpen);
          }}
        >
          {links.map((link) => {
            const active = isLinkActive(pathname, link);
            const hasChildren = Boolean(link.children?.length);
            const menuOpen = desktopMenuOpen === link.id;

            if (!hasChildren && link.href) {
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                    active ? 'text-[var(--on-accent)]' : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                  style={active ? { backgroundColor: resolvedAccent } : undefined}
                  onClick={closeDesktopMenus}
                >
                  {link.label}
                </Link>
              );
            }

            return (
              <div
                key={link.id}
                className="relative"
                onMouseEnter={() => openDesktopMenu(link.id)}
                onMouseLeave={() => scheduleClose(link.id)}
              >
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                    active || menuOpen ? 'text-[var(--on-accent)]' : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                  style={active || menuOpen ? { backgroundColor: resolvedAccent } : undefined}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-controls={`league-menu-${link.id}`}
                  onClick={() => toggleDesktopMenu(link.id)}
                  onFocus={() => openDesktopMenu(link.id)}
                >
                  {link.label}
                  <Chevron open={menuOpen} />
                </button>

                {menuOpen && (
                  <div
                    id={`league-menu-${link.id}`}
                    className="absolute left-0 top-full z-[70] min-w-full pt-2"
                    onMouseEnter={() => openDesktopMenu(link.id)}
                  >
                    <div className="w-60 overflow-hidden rounded-xl border border-white/10 bg-[var(--brand-navy)] p-2 shadow-2xl" role="menu">
                      {(link.children || []).map((child) => {
                        const childActive = isLinkActive(pathname, child);
                        return child.href ? (
                          <Link
                            key={child.id}
                            href={child.href}
                            role="menuitem"
                            aria-current={childActive ? 'page' : undefined}
                            className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                              childActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'
                            }`}
                            style={childActive ? { boxShadow: `inset 3px 0 0 ${resolvedAccent}` } : undefined}
                            onClick={closeDesktopMenus}
                          >
                            {child.label}
                          </Link>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="lg:hidden">
          <div className="flex min-h-14 items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-white/45">League Menu</span>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-expanded={mobileOpen}
              aria-controls="league-mobile-menu"
              onClick={() => setMobileOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="h-5 w-5">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
              Menu
            </button>
          </div>

          {mobileOpen && (
            <div id="league-mobile-menu" className="space-y-2 border-t border-white/10 py-3">
              {links.map((link) => {
                const active = isLinkActive(pathname, link);
                const hasChildren = Boolean(link.children?.length);

                if (!hasChildren && link.href) {
                  return (
                    <Link
                      key={link.id}
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={`block min-h-11 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                        active ? 'text-[var(--on-accent)]' : 'text-white/65 hover:bg-white/10 hover:text-white'
                      }`}
                      style={active ? { backgroundColor: resolvedAccent } : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                }

                const expanded = Boolean(mobileExpanded[link.id]);
                return (
                  <div key={link.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                    <button
                      type="button"
                      className={`flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors ${
                        active ? 'text-white' : 'text-white/65'
                      }`}
                      aria-expanded={expanded}
                      onClick={() => setMobileExpanded((current) => ({ ...current, [link.id]: !expanded }))}
                    >
                      <span>{link.label}</span>
                      <Chevron open={expanded} />
                    </button>
                    {expanded && (
                      <div className="space-y-1 border-t border-white/10 p-2">
                        {(link.children || []).map((child) => {
                          const childActive = isLinkActive(pathname, child);
                          return child.href ? (
                            <Link
                              key={child.id}
                              href={child.href}
                              aria-current={childActive ? 'page' : undefined}
                              className={`block min-h-11 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                                childActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'
                              }`}
                              style={childActive ? { boxShadow: `inset 3px 0 0 ${resolvedAccent}` } : undefined}
                              onClick={() => setMobileOpen(false)}
                            >
                              {child.label}
                            </Link>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
