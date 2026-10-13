/**
 * One shared bookmark format for static public Research and authenticated
 * LeagueZone pages. The server normalizes all incoming items again.
 */
export const SAVED_KEY = 'leaguezone:saved-research:v1';
export const MAX_SAVED = 100;
export type SavedItem = {
  key: string;
  type: 'player' | 'view';
  title: string;
  href: string;
  savedAt: number;
};
export type SavedInput = Pick<SavedItem, 'type' | 'title' | 'href'>;

const researchPath = /^\/research(?:\/(?:players(?:\/[A-Za-z0-9._%-]+)?|stats|radar|receipts|development))?\/?$/;

export function safeHref(input: unknown): string | null {
  if (typeof input !== 'string' || !input.startsWith('/') ||
      input.startsWith('//') || input.length > 750 ||
      /[\\\u0000-\u001f]/.test(input)) return null;
  try {
    const url = new URL(input, 'https://leaguezone.invalid');
    if (url.origin !== 'https://leaguezone.invalid' ||
        !researchPath.test(url.pathname) || url.hash) return null;
    return url.pathname + url.search;
  } catch { return null; }
}

export function normalizeSaved(input: unknown): SavedItem | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<SavedItem>;
  const href = safeHref(raw.href);
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!href || !title || title.length > 150) return null;
  if (raw.type !== 'player' && raw.type !== 'view') return null;
  const url = new URL(href, 'https://leaguezone.invalid');
  let resultHref = href;
  let key = 'view:' + href;
  if (raw.type === 'player') {
    const match = /^\/research\/players\/([^/]+)\/?$/.exec(url.pathname);
    if (!match) return null;
    let playerId: string;
    try { playerId = decodeURIComponent(match[1]); } catch { return null; }
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(playerId)) return null;
    resultHref = '/research/players/' + encodeURIComponent(playerId);
    key = 'player:' + playerId;
  }
  if (key.length > 850) return null;
  const savedAt = typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) &&
    raw.savedAt > 0 && raw.savedAt <= Date.now() + 86_400_000
    ? Math.floor(raw.savedAt) : Date.now();
  return {key, type: raw.type, title, href: resultHref, savedAt};
}

export function readSaved(): SavedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.slice(0, MAX_SAVED).map(normalizeSaved).filter((v): v is SavedItem => {
      if (!v || seen.has(v.key)) return false;
      seen.add(v.key);
      return true;
    });
  } catch { return []; }
}

export function writeSaved(items: SavedItem[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items.slice(0, MAX_SAVED)));
    window.dispatchEvent(new Event('leaguezone:saved-changed'));
    return true;
  } catch { return false; }
}

export function saveResearch(input: SavedInput): boolean {
  const nextItem = normalizeSaved(input);
  if (!nextItem) return false;
  return writeSaved([nextItem, ...readSaved().filter(x => x.key !== nextItem.key)]);
}
