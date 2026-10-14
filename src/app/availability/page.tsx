import type {Metadata} from 'next';
import AvailabilityCenter from '@/components/research/AvailabilityCenter';
export const metadata:Metadata={
 title:'NFL Availability & Opportunity | LeagueZone',
 description:'Reported NFL injury and practice metadata, official source links, and teammate opportunity research. Current-status reporting with freshness disclosures.'
};
export default function AvailabilityPage(){return <AvailabilityCenter/>;}
