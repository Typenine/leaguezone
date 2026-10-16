import {describe,expect,it} from 'vitest';
import {deriveTradeValueFormat} from '@/lib/fantasy/trade-value-format';
describe('league-specific dynasty trade values',()=>{
 it('uses real Superflex, 12-team and half-PPR scoring',()=>{
  expect(deriveTradeValueFormat({roster_positions:['QB','RB','SUPER_FLEX'],total_rosters:12,scoring_settings:{rec:0.5}}))
   .toEqual({superflex:true,teamCount:12,ppr:0.5,key:'sf:12:0.5'});
 });
 it('supports two-QB standard-scoring leagues',()=>{
  expect(deriveTradeValueFormat({roster_positions:['QB','QB','RB'],total_rosters:10,scoring_settings:{rec:0}}))
   .toEqual({superflex:true,teamCount:10,ppr:0,key:'sf:10:0'});
 });
 it('leaves anonymous league-free valuations available',()=>{
  expect(deriveTradeValueFormat(null)).toEqual({superflex:false,teamCount:12,ppr:1,key:'1qb:12:1'});
 });
});
