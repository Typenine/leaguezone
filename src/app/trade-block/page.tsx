import { redirect } from 'next/navigation';

/**
 * Backward-compatible route for old bookmarks and shared links.
 * The structured, league-scoped trade block lives at /trades/block.
 */
export default function LegacyTradeBlockPage() {
  redirect('/trades/block');
}
