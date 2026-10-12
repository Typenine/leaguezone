'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Users, Bookmark, CircleUserRound } from 'lucide-react';
import { useEffect } from 'react';
const tabs = [
  { href: '/?view=public', label: 'Home', Icon: Home },
  { href: '/research', label: 'Research', Icon: Search },
  { href: '/research/players', label: 'Players', Icon: Users },
  { href: '/profile', label: 'Profile', Icon: CircleUserRound },
  { href: '/app', label: 'My Leagues', Icon: Bookmark },
] as const;
export default function MobileAppTabs() {
  const pathname = usePathname() || '/';
  const excluded = ['/login','/register','/setup','/forgot-password','/reset-password','/verify-email','/super-admin','/admin'].some(p=>pathname===p||pathname.startsWith(p+'/'));
  useEffect(() => {
    document.body.classList.toggle('lz-app-tabs-visible', !excluded);
    return () => document.body.classList.remove('lz-app-tabs-visible');
  }, [excluded]);
  if (excluded) return null;
  return <nav aria-label="LeagueZone app navigation" className="lz-bottom-tabs md:hidden">
    {tabs.map(({href,label,Icon}) => {
      const selected = label==='Home' ? pathname==='/' :
        label==='Players' ? pathname.startsWith('/research/players') || pathname==='/research/stats' :
        label==='Research' ? pathname==='/research' || ['/research/radar','/research/receipts','/research/development'].some(route=>pathname.startsWith(route)) :
        label==='My Leagues' ? pathname.startsWith('/app') || pathname.startsWith('/l/') :
        pathname===href || pathname.startsWith(href+'/');
      return <Link key={label} href={href} aria-current={selected?'page':undefined} className={'lz-bottom-tab'+(selected?' lz-bottom-tab-active':'')}><Icon aria-hidden="true" size={21}/><span>{label}</span></Link>;
    })}
  </nav>;
}