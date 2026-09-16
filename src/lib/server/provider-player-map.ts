import type { FantasyPlayer } from '@/lib/providers/types';
import { getAllPlayersCached, type SleeperPlayer } from '@/lib/utils/sleeper-api';

function normalizeName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizePosition(value: string | null | undefined): string {
  const position = String(value || '').toUpperCase();
  if (position === 'D' || position === 'DST' || position === 'D/ST') return 'DEF';
  if (position === 'HB' || position === 'FB') return 'RB';
  if (position === 'PK') return 'K';
  return position;
}

function normalizeTeam(value: string | null | undefined): string {
  const team = String(value || '').toUpperCase();
  const aliases: Record<string, string> = { JAX: 'JAC', WSH: 'WAS', LA: 'LAR' };
  return aliases[team] || team;
}

function sleeperName(player: SleeperPlayer): string {
  return `${player.first_name || ''} ${player.last_name || ''}`.trim();
}

export type ProviderPlayerMap = {
  providerToSleeper: Record<string, string>;
  sleeperToProvider: Record<string, string>;
  sleeperPlayers: Record<string, SleeperPlayer>;
};

export async function mapFantasyPlayersToSleeper(players: FantasyPlayer[]): Promise<ProviderPlayerMap> {
  const all = await getAllPlayersCached();
  const candidatesByName = new Map<string, string[]>();
  const defensesByTeam = new Map<string, string[]>();

  for (const [id, player] of Object.entries(all)) {
    const name = normalizeName(sleeperName(player));
    if (name) candidatesByName.set(name, [...(candidatesByName.get(name) || []), id]);
    if (normalizePosition(player.position) === 'DEF' && player.team) {
      const team = normalizeTeam(player.team);
      defensesByTeam.set(team, [...(defensesByTeam.get(team) || []), id]);
    }
  }

  const providerToSleeper: Record<string, string> = {};
  const sleeperToProvider: Record<string, string> = {};
  for (const player of players) {
    const providerPosition = normalizePosition(player.position);
    const providerTeam = normalizeTeam(player.nflTeam);
    let candidates = candidatesByName.get(normalizeName(player.fullName)) || [];
    if (providerPosition === 'DEF' && providerTeam) candidates = [...candidates, ...(defensesByTeam.get(providerTeam) || [])];
    candidates = [...new Set(candidates)];
    if (!candidates.length) continue;

    const samePosition = candidates.filter((id) => normalizePosition(all[id]?.position) === providerPosition);
    if (samePosition.length) candidates = samePosition;
    const sameTeam = providerTeam ? candidates.filter((id) => normalizeTeam(all[id]?.team) === providerTeam) : [];
    if (sameTeam.length === 1) candidates = sameTeam;
    if (candidates.length !== 1) continue;

    const sleeperId = candidates[0];
    providerToSleeper[player.playerId] = sleeperId;
    if (!sleeperToProvider[sleeperId]) sleeperToProvider[sleeperId] = player.playerId;
  }

  return { providerToSleeper, sleeperToProvider, sleeperPlayers: all };
}
