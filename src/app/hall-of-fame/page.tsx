import type { Metadata } from 'next';
import HallOfFameClient from '@/components/hall-of-fame/HallOfFameClient';

export const metadata: Metadata = {
  title: 'Team Hall of Fame — League',
  description: 'Franchise Hall of Fame inductees and induction classes across League.',
};

export default function HallOfFamePage() {
  return <HallOfFameClient />;
}
