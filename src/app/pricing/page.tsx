import { redirect } from 'next/navigation';

// Preserve existing bookmarks without advertising speculative plans or pricing.
export default function LegacyPricingPage() {
  redirect('/features');
}
