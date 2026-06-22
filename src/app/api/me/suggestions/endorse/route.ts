import { NextRequest } from 'next/server';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { requireTeamUser } from '@/lib/server/session';
import {
  addSuggestionEndorsement,
  removeSuggestionEndorsement,
  getSuggestionVagueMap,
  getSuggestionVoteTagsMap,
  getSuggestionProposersMap,
  getSuggestionTitlesMap,
  getSuggestionGroupsMap,
  markBallotEligibleIfThreshold,
} from '@/server/db/queries';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_SUGGESTIONS_WEBHOOK_URL;
const SITE_URL = process.env.SITE_URL;

async function postBallotEligibleDiscord(
  suggestionId: string,
  eligibleCount: number,
  title?: string,
  category?: string,
  proposerTeam?: string
) {
  if (!DISCORD_WEBHOOK_URL) return;
  const base = (SITE_URL || '').replace(/\/$/, '');
  const link = base ? `${base}/suggestions/${suggestionId}` : undefined;
  const embedTitle = title ? `🗳️ Ballot Eligible: ${title}` : '🗳️ Ballot Eligible';
  let description = `**This suggestion has reached the ballot!**\n\n`;
  description += `**Endorsements:** ${eligibleCount}/3 (threshold met)\n`;
  if (category) description += `**Category:** ${category}\n`;
  if (proposerTeam) description += `**Proposed by:** ${proposerTeam}\n`;
  if (link) description += `\n🔗 **[View Suggestion](${link})**`;
  const embed = { title: embedTitle, description, url: link, color: 0x16a34a, timestamp: new Date().toISOString() };
  const plainContent = link ? `🗳️ **Ballot Eligible${title ? `: ${title}` : ''}** (${eligibleCount}/3 endorsements)\n${link}` : undefined;
  const payload = { content: plainContent, embeds: [embed], allowed_mentions: { parse: [] } };
  const doPost = async (): Promise<Response> => fetch(DISCORD_WEBHOOK_URL!, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  try {
    let res = await doPost();
    if (res.status === 429) {
      const ra = res.headers.get('Retry-After');
      const ms = ra ? parseFloat(ra) * 1000 : 1000;
      await new Promise((r) => setTimeout(r, Math.min(ms, 5000)));
      res = await doPost();
    }
    if (!res.ok) console.warn('[endorse] ballot webhook failed', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.warn('[endorse] ballot webhook error', e);
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  // Resolve team identity — prefer new account-based session, fall back to legacy PIN session
  let teamName: string | null = null;

  const membershipResult = await getActiveLeagueMembership();
  if (membershipResult.ok && membershipResult.membership.teamName) {
    teamName = membershipResult.membership.teamName;
  } else {
    // Legacy PIN fallback
    const legacyIdent = await requireTeamUser();
    if (legacyIdent?.team) teamName = legacyIdent.team;
  }

  if (!teamName) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  type EndorseBody = { suggestionId?: string; endorse?: boolean };
  const body = (await req.json().catch(() => ({}))) as EndorseBody;
  const suggestionId = typeof body.suggestionId === 'string' ? body.suggestionId.trim() : '';
  const endorse = typeof body.endorse === 'boolean' ? body.endorse : null;
  if (!suggestionId) return Response.json({ error: 'suggestionId required' }, { status: 400 });
  if (endorse === null) return Response.json({ error: 'endorse boolean required' }, { status: 400 });

  // Block endorsement if suggestion has voteTag or vague flag set
  try {
    const [vagueMap, voteTagMap, proposerMap] = await Promise.all([
      getSuggestionVagueMap(),
      getSuggestionVoteTagsMap(),
      getSuggestionProposersMap(),
    ]);
    const isVague = vagueMap[suggestionId] === true;
    const hasVoteTag = !!voteTagMap[suggestionId];
    if (isVague || hasVoteTag) {
      return Response.json({ error: 'Cannot endorse a suggestion that has been voted on or needs clarification.' }, { status: 403 });
    }
    const proposer = proposerMap[suggestionId];
    if (proposer && proposer === teamName && endorse) {
      return Response.json({ error: 'You cannot endorse your own proposal.' }, { status: 403 });
    }
  } catch (e) {
    console.warn('[endorse] Failed to check vague/voteTag/proposer', e);
  }

  try {
    const ok = endorse
      ? await addSuggestionEndorsement(suggestionId, teamName)
      : await removeSuggestionEndorsement(suggestionId, teamName);
    if (!ok) return Response.json({ error: 'Persist failed' }, { status: 500 });
    if (endorse) {
      try {
        const { becameEligible, eligibleCount } = await markBallotEligibleIfThreshold(suggestionId);
        if (becameEligible) {
          let title: string | undefined;
          let category: string | undefined;
          let proposerTeam: string | undefined;
          try {
            const [titlesMap, groupsMap, proposersMap] = await Promise.all([
              getSuggestionTitlesMap(),
              getSuggestionGroupsMap(),
              getSuggestionProposersMap(),
            ]);
            title = titlesMap[suggestionId];
            category = groupsMap[suggestionId]?.groupId;
            proposerTeam = proposersMap[suggestionId];
          } catch {}
          postBallotEligibleDiscord(suggestionId, eligibleCount, title, category, proposerTeam).catch(() => {});
        }
      } catch (e) {
        console.warn('[endorse] ballot eligibility check failed', e);
      }
    }
    return Response.json({ ok: true, suggestionId, endorse });
  } catch {
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
