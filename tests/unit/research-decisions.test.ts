import { describe, expect, it } from 'vitest';
import decisions from '../../public/research/insights.js';

type Signal = {direction: string; scoringChange: number; change: number};
const model = decisions as {
  classify: (signal: Signal) => {category: string; label: string; why: string; next: string}|null;
  build: (data: unknown, scoring: string) => Array<{name: string; category: string; signal: unknown}>;
};

describe('Phase 5 decision research', () => {
  it('describes observations without claiming future outcomes or ownership', () => {
    const watch = model.classify({direction:'rising', scoringChange:-4, change:3});
    expect(watch?.category).toBe('watch');
    expect(watch?.why).toMatch(/warrant a closer look/i);
    expect(watch?.next).toMatch(/league availability/i);
    expect(model.classify({direction:'rising',scoringChange:4,change:5})?.category).toBe('momentum');
    expect(model.classify({direction:'falling',scoringChange:4,change:-5})?.category).toBe('risk');
    expect(model.classify({direction:'steady',scoringChange:2,change:0})).toBeNull();
  });
  it('does not generate findings without the four-game minimum', () => {
    const player={id:'one',n:'Example Runner',team:'AAA',pos:'RB',
      w:[[1,'AAA',10,2,3,0,3],[2,'AAA',10,2,3,0,3],[3,'AAA',10,2,3,0,8]]};
    expect(model.build({year:2026,throughWeek:3,players:[player]},'half')).toEqual([]);
  });
  it('uses real radar observations for the published sample and stays deterministic', () => {
    const game=(week:number, attempts:number, points:number): [number,string,number,number,number,number,number] =>
      [week,'AAA',points,2,4,0,attempts];
    const player={id:'demo-id',n:'Example Runner',pos:'RB',team:'AAA',
      w:[game(1,5,8),game(2,6,9),game(3,13,7),game(4,14,7)]};
    const data={year:2026,throughWeek:4,players:[player]};
    const rows=model.build(data,'half');
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('watch');
    expect(rows[0].signal).toMatchObject({week:4,direction:'rising',sample:4});
    expect(model.build(data,'half')).toEqual(rows);
  });
});
