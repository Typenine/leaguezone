import type {Metadata} from 'next';
import WeeklyCenter from '@/components/research/WeeklyCenter';
export const metadata:Metadata={
 title:'NFL Weekly Football Center | LeagueZone',
 description:'Explore NFL game schedules, matchup defense statistics, depth charts, weather forecasts and linked NFL headlines, without fantasy projections.'
};
export default function WeeklyPage(){return <WeeklyCenter/>;}
