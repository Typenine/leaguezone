import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function retiredResponse() {
  return NextResponse.json(
    {
      error: 'This legacy setup step has been retired. The account that creates a league is already that league\'s commissioner.',
      code: 'LEGACY_ADMIN_SETUP_RETIRED',
    },
    { status: 410 },
  );
}

export async function GET() {
  return retiredResponse();
}

export async function POST() {
  return retiredResponse();
}
