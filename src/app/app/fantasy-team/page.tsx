import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/server/session';
import SleeperResearchBoard from '@/components/fantasy/SleeperResearchBoard';

export const dynamic='force-dynamic';
export const metadata={title:'My Sleeper Fantasy Decisions | LeagueZone',robots:{index:false}};
export default async function Page({searchParams}:{searchParams:Promise<{leagueId?:string}>}){
 const user=await requireUser();
 if(!user)redirect('/login?next=%2Fapp%2Ffantasy-team');
 const params=await searchParams;
 return <main className="min-h-screen bg-[var(--brand-ink)]">
  <SleeperResearchBoard initialLeagueId={/^[0-9]{7,25}$/.test(params?.leagueId||'')?params.leagueId!:''}/>
 </main>;
}
