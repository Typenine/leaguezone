/** Determine dynasty market format from real league settings. */
export type MarketValueFormat = {superflex:boolean; teamCount:number; ppr:number; key:string};
export function deriveTradeValueFormat(league: {
  roster_positions?: readonly string[] | null;
  total_rosters?: number | null;
  scoring_settings?: {rec?:number|null} | null;
} | null): MarketValueFormat {
  const slots = league?.roster_positions || [];
  const superflex = slots.includes('SUPER_FLEX') || slots.filter(slot => slot === 'QB').length > 1;
  const teamCount = Math.max(2, Number(league?.total_rosters || 12));
  const ppr = Number(league?.scoring_settings?.rec ?? 1);
  return {superflex,teamCount,ppr,key:(superflex?'sf':'1qb')+':'+teamCount+':'+ppr};
}
