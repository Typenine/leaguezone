'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Home,BookOpen,Users,LayoutDashboard,UserRound} from 'lucide-react';

const tabs=[
  {href:'/?view=public',label:'Home',Icon:Home},
  {href:'/research',label:'Research',Icon:BookOpen},
  {href:'/research/players',label:'Players',Icon:Users},
  {href:'/app',label:'My Leagues',Icon:LayoutDashboard},
  {href:'/profile',label:'Profile',Icon:UserRound},
] as const;

export default function MobileAppTabs(){
  const pathname=usePathname()||'/';
  const excluded=['/login','/register','/setup','/forgot-password','/reset-password',
    '/verify-email','/super-admin','/admin','/e2e-test'];
  if(excluded.some(p=>pathname===p||pathname.startsWith(p+'/')))return null;
  return <nav aria-label="LeagueZone app navigation" className="lz-bottom-tabs">
    {tabs.map(({href,label,Icon})=>{
      const selected=label==='Home'?pathname==='/' :
        label==='Research'?['/research','/weekly','/availability','/my-research','/saved','/search'].includes(pathname)||
          ['/research/radar','/research/receipts','/research/development'].some(p=>pathname.startsWith(p)) :
        label==='Players'?pathname.startsWith('/research/players')||pathname==='/research/stats' :
        label==='My Leagues'?pathname==='/app'||pathname.startsWith('/app/')||pathname.startsWith('/l/') :
        pathname==='/profile'||pathname.startsWith('/profile/');
      return <Link key={label} href={href} aria-current={selected?'page':undefined}
        className={'lz-bottom-tab'+(selected?' lz-bottom-tab-active':'')}>
        <Icon aria-hidden="true" size={22} strokeWidth={selected?2.4:1.8}/>
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}
