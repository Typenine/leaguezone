export type CustomDraftPlayer = {
  id: string;
  name: string;
  pos: string;
  nfl: string | null;
  rank: number | null;
  meta: Record<string, unknown>;
};

const ALLOWED_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'FB', 'RB/FB', 'DEF']);

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function fallbackId(name: string, pos: string, nfl: string | null): string {
  return `custom:${slug(pos)}:${slug(name)}:${slug(nfl || 'na')}`;
}

function normalizePlayer(input: Record<string, unknown>, index: number): CustomDraftPlayer | null {
  const firstName = String(input.first_name ?? input.firstName ?? '').trim();
  const lastName = String(input.last_name ?? input.lastName ?? '').trim();
  const name = String(input.name ?? input.player ?? `${firstName} ${lastName}`).trim();
  const pos = String(input.pos ?? input.position ?? '').trim().toUpperCase();
  const nflRaw = String(input.nfl ?? input.team ?? input.nfl_team ?? '').trim().toUpperCase();
  const nfl = nflRaw || null;
  if (!name || !ALLOWED_POSITIONS.has(pos)) return null;

  const rawId = String(input.id ?? input.player_id ?? input.playerId ?? '').trim();
  const id = rawId || fallbackId(name, pos, nfl) || `custom:${index + 1}`;
  const rankRaw = input.rank ?? input.overall_rank ?? input.overall_pick ?? input.pick;
  const rankNumber = rankRaw == null || rankRaw === '' ? null : Number(rankRaw);
  const rank = Number.isFinite(rankNumber) && rankNumber! > 0 ? Math.trunc(rankNumber!) : null;
  const source = rawId ? 'custom-import-id' : 'custom-import';

  return {
    id,
    name,
    pos,
    nfl,
    rank,
    meta: {
      source,
      importedIndex: index + 1,
    },
  };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCustomDraftPlayerPool(text: string): CustomDraftPlayer[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const json = JSON.parse(trimmed) as unknown;
    if (Array.isArray(json)) {
      return json
        .map((item, index) => item && typeof item === 'object' ? normalizePlayer(item as Record<string, unknown>, index) : null)
        .filter((player): player is CustomDraftPlayer => Boolean(player));
    }
  } catch {
    // Continue to CSV parsing.
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1)
    .map((line, index) => {
      const values = parseCsvLine(line);
      const input: Record<string, unknown> = {};
      headers.forEach((header, column) => { input[header] = values[column] ?? ''; });
      return normalizePlayer(input, index);
    })
    .filter((player): player is CustomDraftPlayer => Boolean(player));
}

export function validateCustomDraftPlayers(players: CustomDraftPlayer[]): string | null {
  if (players.length === 0) return 'Custom player pool is empty.';
  const ids = new Set<string>();
  for (const player of players) {
    if (!player.id || !player.name || !ALLOWED_POSITIONS.has(player.pos)) return 'Custom player pool contains an invalid player.';
    if (ids.has(player.id)) return `Duplicate player ID in custom pool: ${player.id}`;
    ids.add(player.id);
  }
  return null;
}
