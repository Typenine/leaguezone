export type LeagueCalendar = {
  season: number;
  leagueYearStart: Date;
  rookieDraft: Date;
  faBiddingStart: Date;
  regularSeasonStart: Date;
  tradeDeadline: Date;
  postseasonStart: Date;
  nextLeagueYearStart: Date;
};

type CalendarConfig = Record<string, unknown>;

function validDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstThursdayOfSeptember(year: number): Date {
  const date = new Date(Date.UTC(year, 8, 1));
  while (date.getUTCDay() !== 4) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function configuredDate(config: CalendarConfig, key: string): Date | null {
  const dates = (config.importantDates || {}) as Record<string, unknown>;
  const direct = validDate(dates[key]);
  if (direct) return direct;
  const events = Array.isArray(config.calendarEvents) ? config.calendarEvents : [];
  const match = events.find((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const row = entry as Record<string, unknown>;
    return row.key === key || row.type === key;
  }) as Record<string, unknown> | undefined;
  return validDate(match?.date);
}

/** Build a calendar from commissioner settings, with neutral NFL-shaped estimates. */
export function buildLeagueCalendar(config: CalendarConfig = {}, season = new Date().getUTCFullYear()): LeagueCalendar {
  const regularSeasonStart = configuredDate(config, 'nflWeek1') || firstThursdayOfSeptember(season);
  const rookieDraft = configuredDate(config, 'nextDraft') || new Date(Date.UTC(season, 6, 15, 17));
  const faBiddingStart = configuredDate(config, 'faBiddingStart') || addDays(regularSeasonStart, -21);
  const tradeDeadline = configuredDate(config, 'tradeDeadline') || addDays(regularSeasonStart, 88);
  const postseasonStart = configuredDate(config, 'playoffsStart') || addDays(regularSeasonStart, 98);
  const leagueYearStart = configuredDate(config, 'leagueYearStart') || new Date(Date.UTC(season, 1, 15));
  const nextLeagueYearStart = configuredDate(config, 'nextLeagueYearStart') || new Date(Date.UTC(season + 1, 1, 15));
  return { season, leagueYearStart, rookieDraft, faBiddingStart, regularSeasonStart, tradeDeadline, postseasonStart, nextLeagueYearStart };
}

/** Backwards-compatible neutral calendar for legacy pages without league context. */
export function selectCalendar(now: Date): LeagueCalendar {
  return buildLeagueCalendar({}, now.getUTCFullYear());
}

export function nextCalendar(calendar: LeagueCalendar): LeagueCalendar {
  return buildLeagueCalendar({}, calendar.season + 1);
}
