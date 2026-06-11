import { redirect } from 'next/navigation';

export default function PodcastRedirectPage() {
  redirect('/newsletter?tab=podcast');
}
