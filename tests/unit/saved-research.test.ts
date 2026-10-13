import {describe,it,expect} from 'vitest';
import {normalizeSaved,safeHref} from '@/lib/saved-research';

describe('saved research normalization',()=>{
  it('treats player watchlists as cross-season identities',()=>{
    const old=normalizeSaved({type:'player',title:'Josh Allen',
      href:'/research/players/00-0034857?season=2026',savedAt:1234});
    const next=normalizeSaved({type:'player',title:'Josh Allen',
      href:'/research/players/00-0034857?season=2027'});
    expect(old?.key).toBe('player:00-0034857');
    expect(old?.href).toBe('/research/players/00-0034857');
    expect(next?.key).toBe(old?.key);
  });
  it('preserves a saved statistical filter as a distinct research view',()=>{
    const p=normalizeSaved({type:'view',title:'Rookie leaders',
      href:'/research/stats?rookies=1&sort=ppg'});
    expect(p?.key).toBe('view:/research/stats?rookies=1&sort=ppg');
    expect(p?.href).toContain('rookies=1');
  });
  it('rejects external URLs, traversal, fragments and invalid player IDs',()=>{
    expect(safeHref('https://evil.example/research/stats')).toBeNull();
    expect(safeHref('//evil.example/research')).toBeNull();
    expect(safeHref('/research/../api/auth/me')).toBeNull();
    expect(safeHref('/research#fragment')).toBeNull();
    expect(normalizeSaved({type:'player',href:'/research/players/%2Fsecret',title:'Invalid'})).toBeNull();
    expect(normalizeSaved({type:'view',href:'/app',title:'Private'})).toBeNull();
  });
});
