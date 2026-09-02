import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('strict LeagueZone provider resolution', () => {
  it('does not allow an explicit LeagueZone league to be replaced by the global Sleeper environment ID', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/server/league-config.ts'), 'utf8');
    expect(source).toContain('if (!explicitLeagueId && process.env.SLEEPER_LEAGUE_ID)');
    expect(source).toContain("if (!row) return { current: '', previous: {} }");
  });
});
