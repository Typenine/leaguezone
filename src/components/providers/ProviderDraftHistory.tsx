import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { getFantasyDraftHistory } from '@/lib/server/provider-deep-data';

export default async function ProviderDraftHistory({ leagueId }: { leagueId: string }) {
  const seasons = await getFantasyDraftHistory(leagueId).catch(() => []);
  if (!seasons.length) return null;
  return <div className="container mx-auto px-4 pt-6"><Card><CardHeader><CardTitle>Imported Yahoo Draft History</CardTitle></CardHeader><CardContent className="space-y-5">{seasons.map((season) => <section key={season.season}><h3 className="mb-2 font-black">{season.season}</h3>{season.results.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-[var(--border)] text-left text-[var(--muted)]"><th className="py-2">Pick</th><th>Round</th><th>Team</th><th>Player</th></tr></thead><tbody>{season.results.map((pick) => <tr key={`${season.season}-${pick.pick}`} className="border-b border-[var(--border)]/60"><td className="py-2">{pick.pick}</td><td>{pick.round}</td><td>{pick.teamName || pick.providerTeamId}</td><td>{pick.playerName || pick.providerPlayerId}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[var(--muted)]">Yahoo did not return draft results for this season.</p>}</section>)}</CardContent></Card></div>;
}
