import PlayerLeagueLookup from '@/components/research/PlayerLeagueLookup';
export default async function Page({params}:{params:Promise<{playerId:string}>}){
 const {playerId}=await params;
 return <main className="container mx-auto max-w-4xl px-4 py-10">
  <h1 className="text-3xl font-bold">Player ownership</h1>
  <p className="mt-3 text-sm text-[var(--muted)]">Choose a league to check player ownership against a current roster snapshot.</p>
  <PlayerLeagueLookup playerId={playerId}/>
 </main>;
}
