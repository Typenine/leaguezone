import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Compatibility redirect: league homepages moved from /leagues/[slug] to /l/[slug]. */
export default async function LegacyLeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/l/${encodeURIComponent(slug)}`);
}
