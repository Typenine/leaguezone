import Card, { CardContent } from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import SectionHeader from '@/components/ui/SectionHeader';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import type { PlayerHonor } from '@/lib/types/player-honors';

export default function PlayerHonorsSection({ honors }: { honors: PlayerHonor[] }) {
  if (!honors.length) return null;
  const summary = [...new Set(honors.map((honor) => honor.label))];
  return <section><SectionHeader title="Honors" subtitle="Annual awards and All-League selections under this league's scoring settings." /><div className="mb-3 flex flex-wrap gap-2">{summary.map((label) => <Chip key={label}>{label}</Chip>)}</div><Card><CardContent className="overflow-x-auto p-0"><Table><THead><Tr><Th>Season</Th><Th>Honor</Th><Th>Position</Th></Tr></THead><TBody>{honors.map((honor) => <Tr key={honor.id}><Td className="font-semibold">{honor.season}</Td><Td className="font-semibold">{honor.label}</Td><Td>{honor.position || '—'}</Td></Tr>)}</TBody></Table></CardContent></Card></section>;
}
