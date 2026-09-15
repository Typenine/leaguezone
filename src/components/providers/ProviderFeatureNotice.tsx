import Link from 'next/link';
import Card, { CardContent } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';

export default function ProviderFeatureNotice({ title, message, backHref, backLabel = 'Back' }: { title: string; message: string; backHref?: string; backLabel?: string }) {
  return <main className="container mx-auto px-4 py-8"><SectionHeader title={title} actions={backHref ? <Link href={backHref} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold">{backLabel}</Link> : undefined} /><Card className="mt-5"><CardContent className="p-5"><p className="text-sm text-[var(--muted)]">{message}</p></CardContent></Card></main>;
}
