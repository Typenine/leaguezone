export const DASHBOARD_SECTIONS = ['activity','feed','leagues','recent'] as const;
export type DashboardSection = typeof DASHBOARD_SECTIONS[number];
export const RESEARCH_POSITIONS = ['QB','RB','WR','TE','K','DEF'] as const;
export type ResearchPosition = typeof RESEARCH_POSITIONS[number];
export type DashboardPreferences = {
  sections: DashboardSection[];
  hidden: DashboardSection[];
  scoring: 'half'|'ppr'|'standard';
  positions: ResearchPosition[];
  favoriteLeagueId: string|null;
};
export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  sections:[...DASHBOARD_SECTIONS], hidden:[], scoring:'half',
  positions:[...RESEARCH_POSITIONS], favoriteLeagueId:null,
};
function selected<T extends string>(value:unknown, allowed: readonly T[]):T[] {
  if(!Array.isArray(value))return [];
  return [...new Set(value.filter((s):s is T => typeof s==='string'&&allowed.includes(s as T)))];
}
export function normalizeDashboardPreferences(value:unknown):DashboardPreferences {
  const v = value && typeof value==='object' ? value as Record<string,unknown> : {};
  const ordered=selected(v.sections,DASHBOARD_SECTIONS);
  const positions=selected(v.positions,RESEARCH_POSITIONS);
  return {
    sections:[...ordered,...DASHBOARD_SECTIONS.filter(s=>!ordered.includes(s))],
    hidden:selected(v.hidden,DASHBOARD_SECTIONS),
    scoring:v.scoring==='ppr'||v.scoring==='standard'?v.scoring:'half',
    positions:positions.length?positions:[...RESEARCH_POSITIONS],
    favoriteLeagueId:typeof v.favoriteLeagueId==='string'&&/^[0-9a-f-]{36}$/i.test(v.favoriteLeagueId)?v.favoriteLeagueId:null,
  };
}
export function moveSection(p:DashboardPreferences,section:DashboardSection,direction:-1|1):DashboardPreferences {
  const index=p.sections.indexOf(section),next=index+direction;
  if(index<0||next<0||next>=p.sections.length)return p;
  const sections=p.sections.slice();[sections[index],sections[next]]=[sections[next],sections[index]];
  return {...p,sections};
}
