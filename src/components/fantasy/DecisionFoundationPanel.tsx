'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {Need} from '@/lib/fantasy/personalized-decisions';
import type {LineupOptimizerResponse} from '@/lib/fantasy/lineup-types';
import {marketById,type MarketIndex} from '@/lib/fantasy/decision-quality';
import {adviseLineup,adviseWaivers,type WaiverLead} from '@/lib/fantasy/decision-foundation';
import LineupComparison from '@/components/fantasy/LineupComparison';
import TeamManagementAdvisor from '@/components/fantasy/TeamManagementAdvisor';
import AdvancedDecisionTools, {type DecisionScope} from '@/components/fantasy/AdvancedDecisionTools';
import type {TaxiContext} from '@/lib/fantasy/taxi-context';
import type {PublicToolKey} from '@/lib/fantasy/public-tools';

type Props={endpoint:string;rosters:Pick<FantasyRostersData,'teams'|'players'>;teamId:number;
 starterSlots:string[];needs:Need[];waiver:WaiverLead[];season:number;throughWeek:number;
 source:'live'|'backup';taxiContext?:TaxiContext|null;scope?:DecisionScope;tool?:PublicToolKey;onSelect?:(which:'waiver'|'lineup')=>void};
async function load(url:string){
 const res=await fetch(url,{credentials:'same-origin',cache:'no-store'});
 const body=await res.json().catch(()=>({})) as {error?:string;values?:MarketIndex};
 if(!res.ok)throw Error(body.error||'Temporarily unavailable.');
 return body;
}
export default function DecisionFoundationPanel({endpoint,roste¶»§q«^