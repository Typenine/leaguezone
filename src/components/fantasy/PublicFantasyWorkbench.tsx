'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {parseSleeperLeagueInput} from '@/lib/sleeper-research-shared';
import {readRememberedLeague,rememberLeague,loadSavedSleeperTeams,preferredSleeperTeam,preferSleeperTeam,type SavedSleeperTeam} from '@/lib/fantasy/remembered-league';
import TradeAnalyzerClient from '@/components/trades/TradeAnalyzerClient';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {TaxiContext} from '@/lib/fantasy/taxi-context';
import type {Need} from '@/lib/fantasy/personalized-decisions';
import {rosterNeeds,decisionCandidates} from '@/lib/fantasy/personalized-decisions';
import {validateResearchSnapshot,type ResearchSnapshot,type RadarSignal} from '@/lib/research-dashboard';
import DecisionFoundationPanel from '@/components/fantasy/DecisionFoundationPanel';
import {FANTASY_TOOLS,publicToolUrl,type PublicToolKey} from '@/lib/fantasy/public-tools';
import {PROSPECT_BASELINE_2027} from '@/components/draft/TeamProspectDraftboard';
import opportunityEngine from '../../../public/research/opportunities.js';
import decisionEngine from '../../../public/research/insights.js';

type Team={rosterId:number;teamName:string};
type Preview={leagueId:string;leagueName:string;season:number;teams:Team[]};
type Context=FantasyRostersData & {
 catalog:{id:string;gsisId:string|null;name:string;position:string;team:string}[];
 viewerRosterId:number;starte¶»§q«^