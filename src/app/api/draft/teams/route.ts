import { NextResponse } from 'next/server';
import { getActiveOrLatestDraftId } from '@/server/db/queries';
import { getDraftOriginalTeams } from '@/server/db/draft-setup-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const draftId = await getActiveOrLatestDraftId();
    if (!draftId) return NextResponse.json({ teams: [] });
    const teams = await getDraftOriginalTeams(draftId);
    return NextResponse.json({ teams });
  } catch (error) {
    console.error('GET /api/draft/teams failed', error);
    return NextResponse.json({ teams: [] }, { status: 500 });
  }
}
