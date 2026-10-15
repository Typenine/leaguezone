'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Home,Building2,BookOpen,Wrench,LayoutDashboard} from 'lucide-react';
import {getNavigationSurface} from '@/lib/navigation/surfaces';
import {getPlatformNavigationSection} from '@/lib/navigation/platform';

const tabs=[
  {href:'/',label:'Home',key:'home',Icon:Home},
  {href:'/features',label:'Leagues',key:'websites',Icon:Building2},
  {href:'/research',label:'Research',key:'research',Icon:BookOpen},
  {href:'/fantasy-tools',label:'Tools',key:'tools',Icon:Wrench},
  {href:'/app',label:'Hub',key:'hub',Icon:LayoutDashboard},
] as const;

export default function MobileAppTabs(){
  const pathname=usePathname()||'/';
  const excluded=['/login','/register','/setup','/forgot-password','/reset-password',
    '/verify-email','/super-admin','/admin','/e2e-test'];
  if(getNavigationSurface(pathname)!=='platform' ||
    excluded.some(p=>pathname===p||pathname.startsWith(p+'/')))return null;
  const section=getPlatformNavigationSection(pathname);
  return <nav aria-label="LeagueZone app navigation" className="lz-bottom-tabs">
    {tabs.map(({href,label,key,Icon})=>{
      const selected=section===key;
      return <Link key={key} href={href} aria-current={selected?'page':undefined}
        className={'lz-bottom-tab'+(selected?' lz-bottom-tab-active':'')}>
        <Icon aria-hidden="true" size={22} strokeWidth={selected?2.4:1.8}/>
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}
