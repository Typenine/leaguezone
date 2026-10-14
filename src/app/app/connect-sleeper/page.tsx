import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/server/session';
import SleeperResearchConnect from '@/components/fantasy/SleeperResearchConnect';

export const dynamic='force-dynamic';
export const metadata={title:'Connect a Sleeper Team | LeagueZone',robots:{index:false}};
export default async function Page(){
 const user=await requireUser();
 if(!user)redirect('/login?next=%2Fapp%2Fconnect-sleeper');
 return <main className="min-h-screen bg-[var(--brand-ink)]"><SleeperResearchConnect/></main>;
}
