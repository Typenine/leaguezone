import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildLeagueCalendar } from '@/lib/constants/league-calendar';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { getLeague as getSleeperLeague, getLeagueMatchups, getRosterIdToTeamNameMap, type SleeperMatchup } from '@/lib/utils/sleeper-api';

export const dynamic = 'force-dynamic';

type CalendarEvent = { label: string; date: Date; description?: string; href?: string; kind: 'league' | 'matchup' };

function configuredEvents(config: Record<string, unknown>): CalendarEvent[] {
  const dates = (config.importantDates || {}) as Record<string, unknown>;
  const labels: Record<string, string> = { nflWeek1: 'Regular season begins', tradeDeadline: 'Trade deadline', playoffsStart: 'Playoffs begin', nextDraft: 'Rookie draft', faBiddingStart: 'Free agency opens' };
  const standard = Object.entries(labels).flatMap(([key, label]) => typeof dates[key] === 'string' && !Number.isNaN(Date.parse(String(dates[key]))) ? [{ label, date: new Date(String(dates[key])), kind: 'league' as const }] : []);
  const custom = Array.isArray(config.calendarEvents) ? config.calendarEvents.flatMap((entry): CalendarEvent[] => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    return typeof row.label === 'string' && typeof row.date === 'string' && !Number.isNaN(Date.parse(row.date)) ? [{ label: row.label, date: new Date(row.date), description: typeof row.description === 'string' ? row.description : undefined, kind: 'league' }] : [];
  }) : [];
  return [...standard, ...custom];
}

function monthValue(value: string | undefined, fallback: Date) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
  const year = Number(match[1]); const month = Number(match[2]) - 1;
  return month >= 0 && month < 12 ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
}

function monthKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`; }
function dateKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`; }

export default async function LeagueCalendarPage({ params, searchParams }: { params: Promise<{ leagueSlug: string }>; searchParams: Promise<{ month?: string }> }) {
  const [{ leagueSlug }, query] = await Promise.all([params, searchParams]);
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  const membership = await getActiveLeagueMembership(league.id);
  const sleeper = league.sleeperLeagueId ? await getSleeperLeague(league.sleeperLeagueId).catch(() => null) : null;
  const season = Number(sleeper?.season || new Date().getUTCFullYear());
  const calendar = buildLeagueCalendar(league.config, season);
  const events = configuredEvents(league.config);
  const rosterId = membership.ok ? membership.membership.rosterId : null;
  const settings = (sleeper?.settings || {}) as { playoff_week_start?: number; playoff_start_week?: number };
  const lastWeek = Math.min(18, Math.max(17, Number(settings.playoff_week_start ?? settings.playoff_start_week ?? 15) + 2));
  if (league.sleeperLeagueId && rosterId) {
    const names = await getRosterIdToTeamNameMap(league.sleeperLeagueId).catch(() => new Map<number, string>());
    const weeks = await Promise.all(Array.from({ length: lastWeek }, (_, index) => getLeagueMatchups(league.sleeperLeagueId!, index + 1).catch(() => [] as SleeperMatchup[])));
    weeks.forEach((rows, index) => {
      const mine = rows.find((row) => row.roster_id === rosterId); if (!mine) return;
      const opponent = rows.find((row) => row.matchup_id === mine.matchup_id && row.roster_id !== rosterId); if (!opponent) return;
      events.push({ label: `Week ${index + 1} vs ${names.get(opponent.roster_id) || `Roster ${opponent.roster_id}`}`, date: new Date(calendar.regularSeasonStart.getTime() + index * 7 * 86_400_000), href: `/l/${league.slug}/matchups/${index + 1}/${mine.matchup_id}`, kind: 'matchup' });
    });
  }
  const selectedMonth = monthValue(query.month, events.find((event) => event.date.getTime() >= Date.now())?.date || new Date());
  const previous = new Date(Date.UTC(selectedMonth.getUTCFullYear(), selectedMonth.getUTCMonth() - 1, 1));
  const next = new Date(Date.UTC(selectedMonth.getUTCFullYear(), selectedMonth.getUTCMonth() + 1, 1));
  const daysInMonth = new Date(Date.UTC(selectedMonth.getUTCFullYear(), selectedMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const leading = selectedMonth.getUTCDay();
  const cells = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const byDate = new Map<string, CalendarEvent[]>(); events.forEach((event) => byDate.set(dateKey(event.date), [...(byDate.get(dateKey(event.date)) || []), event]));
  return <main className="container mx-auto px-4 py-8"><p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">{league.name}</p><div className="mt-1 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black">League Calendar</h1><p className="mt-2 text-sm text-[var(--muted)]">Commissioner dates and your Sleeper matchups.</p></div><div className="flex gap-2"><Link href={`?month=${monthKey(previous)}`} aria-label="Previous month" className="rounded-lg border border-[var(--border)] px-3 py-2">Previous</Link><Link href={`?month=${monthKey(next)}`} aria-label="Next month" className="rounded-lg border border-[var(--border)] px-3 py-2">Next</Link></div></div><h2 className="mt-8 text-xl font-black">{selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><div className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)]">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <div key={day} className="bg-[var(--surface-strong)] p-2 text-center text-[10px] font-black uppercase text-[var(--muted)]">{day}</div>)}{cells.map((day, index) => { const date = day ? new Date(Date.UTC(selectedMonth.getUTCFullYear(), selectedMonth.getUTCMonth(), day)) : null; const dayEvents = date ? byDate.get(dateKey(date)) || [] : []; return <div key={`${index}-${day || 'blank'}`} className="min-h-28 bg-[var(--surface)] p-2">{day && <><div className="text-xs font-black">{day}</div><div className="mt-2 space-y-1">{dayEvents.map((event) => { const content = <><span className="block font-bold">{event.label}</span>{event.description && <span className="block opacity-75">{event.description}</span>}</>; return event.href ? <Link key={`${event.label}-${event.date.toISOString()}`} href={event.href} className="block rounded-md bg-[var(--accent)]/15 p-1.5 text-[10px] text-[var(--text)] hover:bg-[var(--accent)]/25">{content}</Link> : <div key={`${event.label}-${event.date.toISOString()}`} className="rounded-md bg-black/10 p-1.5 text-[10px]">{content}</div>; })}</div></>}</div>; })}</div><p className="mt-4 text-xs text-[var(--muted)]">Dates are displayed in UTC on the calendar grid. Countdown cards on your dashboard use your saved device timezone.</p></main>;
}
