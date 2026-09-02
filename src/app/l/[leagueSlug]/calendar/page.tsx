import { notFound } from 'next/navigation';
import { getLeagueBySlug } from '@/lib/server/league-context';

export const dynamic = 'force-dynamic';

type CalendarEvent = { label: string; date: string; description?: string };

function configuredEvents(config: Record<string, unknown>): CalendarEvent[] {
  const dates = (config.importantDates || {}) as Record<string, unknown>;
  const labels: Record<string, string> = {
    nflWeek1: 'Regular season begins',
    tradeDeadline: 'Trade deadline',
    playoffsStart: 'Playoffs begin',
    nextDraft: 'Rookie draft',
  };
  const standard = Object.entries(labels).flatMap(([key, label]) => {
    const value = dates[key];
    return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? [{ label, date: value }] : [];
  });
  const custom = Array.isArray(config.calendarEvents)
    ? config.calendarEvents.flatMap((entry): CalendarEvent[] => {
        if (!entry || typeof entry !== 'object') return [];
        const row = entry as Record<string, unknown>;
        return typeof row.label === 'string' && typeof row.date === 'string' && !Number.isNaN(Date.parse(row.date))
          ? [{ label: row.label, date: row.date, description: typeof row.description === 'string' ? row.description : undefined }]
          : [];
      })
    : [];
  return [...standard, ...custom].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export default async function LeagueCalendarPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  const events = configuredEvents(league.config);
  const now = Date.now();

  return (
    <main className="container mx-auto px-4 py-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">{league.name}</p>
      <h1 className="mt-1 text-3xl font-black text-[var(--text)]">League Calendar</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Official dates and deadlines configured by your commissioner.</p>
      {events.length ? (
        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          {events.map((event) => {
            const date = new Date(event.date);
            const upcoming = date.getTime() >= now;
            return (
              <li key={`${event.label}-${event.date}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><h2 className="font-bold text-[var(--text)]">{event.label}</h2>{event.description ? <p className="mt-1 text-sm text-[var(--muted)]">{event.description}</p> : null}</div>
                  <span className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider" style={{ background: upcoming ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--subtle)', color: upcoming ? 'var(--accent)' : 'var(--muted)' }}>{upcoming ? 'Upcoming' : 'Complete'}</span>
                </div>
                <time dateTime={event.date} className="mt-4 block text-lg font-black text-[var(--text)]">{date.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' })} UTC</time>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">No league dates have been configured yet. Commissioners can add the draft, season, deadline, and playoff dates in Settings.</div>
      )}
    </main>
  );
}
