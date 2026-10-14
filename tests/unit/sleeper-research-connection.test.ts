import {describe,it,expect} from 'vitest';
import {parseSleeperLeagueInput} from '@/lib/sleeper-research-shared';
import {matchesUser,validLeagueId,validSleeperUserId} from '@/lib/server/sleeper-research';

describe('research-only Sleeper connection validation',()=>{
 it('accepts numeric league IDs and expected Sleeper league URLs',()=>{
  expect(parseSleeperLeagueInput('1234567890123456789')).toBe('1234567890123456789');
  expect(parseSleeperLeagueInput('https://sleeper.app/leagues/1234567890123456789/league')).toBe('1234567890123456789');
  expect(parseSleeperLeagueInput('https://sleeper.com/leagues/1234567890123456789')).toBe('1234567890123456789');
 });
 it('rejects attacker-controlled domains, path injection and malformed IDs',()=>{
  expect(parseSleeperLeagueInput('https://sleeper.app.attacker.example/leagues/1234567890123456789')).toBeNull();
  expect(parseSleeperLeagueInput('https://attacker.example/sleeper.app/leagues/1234567890123456789')).toBeNull();
  expect(parseSleeperLeagueInput('123abc')).toBeNull();
  expect(validLeagueId('1234567890123456789')).toBe(true);
  expect(validSleeperUserId('111222333')).toBe(true);
  expect(validSleeperUserId('anyone@example.com')).toBe(false);
 });
 it('only matches an owning or co-owning Sleeper account',()=>{
  const roster={roster_id:7,owner_id:'111222333',co_owners:['444555666'],players:['101']};
  expect(matchesUser(roster,'111222333')).toBe(true);
  expect(matchesUser(roster,'444555666')).toBe(true);
  expect(matchesUser(roster,'777888999')).toBe(false);
 });
});
