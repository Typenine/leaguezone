import { describe, expect, it } from 'vitest';
import {
  normalizeCustomDraftPlayersInput,
  parseCustomDraftPlayerPool,
  validateCustomDraftPlayers,
} from './custom-player-pool';

describe('custom draft player pools', () => {
  it('parses CSV while retaining Sleeper IDs', () => {
    const players = parseCustomDraftPlayerPool('id,name,pos,nfl,rank\n12345,Test Runner,RB,GB,1\nGB,Green Bay,DEF,GB,2');
    expect(players).toHaveLength(2);
    expect(players[0]).toMatchObject({ id: '12345', name: 'Test Runner', pos: 'RB', nfl: 'GB', rank: 1 });
    expect(players[0].meta.source).toBe('custom-import-id');
    expect(players[1].pos).toBe('DEF');
  });

  it('parses quoted CSV cells', () => {
    const players = parseCustomDraftPlayerPool('name,pos,nfl\n"Smith, John",WR,KC');
    expect(players[0].name).toBe('Smith, John');
  });

  it('creates a stable fallback ID when an import omits one', () => {
    const players = parseCustomDraftPlayerPool('[{"name":"Future Prospect","pos":"WR","nfl":"SEA"}]');
    expect(players[0].id).toContain('custom:wr:future-prospect:sea');
  });

  it('normalizes untrusted API input and drops unsupported positions', () => {
    const players = normalizeCustomDraftPlayersInput([
      { player_id: '1', player: 'Valid Player', position: 'TE', team: 'PIT' },
      { id: '2', name: 'IDP Player', pos: 'LB', nfl: 'PIT' },
    ]);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ id: '1', name: 'Valid Player', pos: 'TE', nfl: 'PIT' });
  });

  it('rejects duplicate IDs', () => {
    const players = normalizeCustomDraftPlayersInput([
      { id: 'same', name: 'One', pos: 'RB' },
      { id: 'same', name: 'Two', pos: 'WR' },
    ]);
    expect(validateCustomDraftPlayers(players)).toContain('Duplicate player ID');
  });
});
