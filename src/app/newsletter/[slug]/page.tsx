import type { Metadata } from 'next';
import IssueReader from './IssueReader';

export const metadata: Metadata = {
  title: 'Newsletter Issue • Fantasy Football League',
};

type PageProps = { params: Promise<{ slug: string }> };

export default async function NewsletterIssuePage({ params }: PageProps) {
  const { slug } = await params;
  return <IssueReader slug={slug} />;
}
