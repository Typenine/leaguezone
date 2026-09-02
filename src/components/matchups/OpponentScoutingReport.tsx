import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { PlayerRow } from '@/components/matchups/RosterColumn';

type Availability = Record<string, { weight?: number; reasons?: string[] }>;

function topPlayers(rows: PlayerRow[]) {
  return [...rows].sort((a, b) => Number(b.pts || 0) - Number(a.pts || 0)).slice(0, 3);
}

function positionStrength(rows: PlayerRow[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => totals.set(row.pos || 'FLEX', (totals.get(row.pos || 'FLEX') || 0) + Number(row.pts || 0)));
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
}

function TeamReport({ name, rows, availability }: { name: string; rows: PlayerRow[]; availability: Availability }) {
  const risks = rows.filter((row) => (availability[row.id]?.weight ?? 1) < 0.9);
  return <section className="rounded-xl border border-[var(--border)] p-4"><h3 className="font-black">{name}</h3><p className="mt-1 text-xs text-[var(--muted)]">Projected strengths and lineup risk</p><div className="mt-4"><h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Players to watch</h4><ul className="mt-2 space-y-1 text-sm">{topPlayers(rows).map((row) => <li key={row.id} className="flex justify-between gap-3"><span>{row.name}</span><span className="font-bold tabular-nums">{Number(row.projected ?? row.pts ?? 0).toFixed(1)}</span></li>)}</ul></div><div className="mt-4"><h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Position strength</h4><div className="mt-2 flex flex-wrap gap-2">{positionStrength(rows).map(([position, total]) => <span key={position} className="rounded-full border border-[var(--border)] px-2 py-1 text-xs font-bold">{position} {total.toFixed(1)}</span>)}</div></div><div className="mt-4"><h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Availability risk</h4><p className="mt-2 text-sm text-[var(--muted)]">{risks.length ? risks.map((row) => row.name).join(', ') : 'No material availability flags.'}</p></div></section>;
}

export default function OpponentScoutingReport({ leftName, rightName, leftStarters, rightStarters, availability }: { leftName: string; rightName: string; leftStarters: PlayerRow[]; rightStarters: PlayerRow[]; availability: Availability }) {
  return <Card className="mb-8"><CardHeader><CardTitle>Opponent Scouting Report</CardTitle></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2"><TeamReport name={leftName} rows={leftStarters} availability={availability} /><TeamReport name={rightName} rows={rightStarters} availability={availability} /></div></CardContent></Card>;
}
