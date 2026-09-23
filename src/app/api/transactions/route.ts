import { NextRequest, NextResponse } from "next/server";
import { buildTransactionLedger } from "@/lib/utils/transactions";
import { getCurrentLeague } from "@/lib/server/league-context";
import { guardPublicDataRequest } from "@/lib/server/public-api-guard";
import { readThroughReliabilityCache, reliabilityKey, reliabilityResponseHeaders } from "@/lib/server/reliability-cache";

function sortTransactions(
  transactions: Awaited<ReturnType<typeof buildTransactionLedger>>,
  sortKey: string | null,
  direction: string | null,
) {
  const dir = direction === "asc" ? 1 : -1;
  const key = sortKey || "created";
  const sorted = [...transactions];
  sorted.sort((a, b) => {
    if (key === "faab") {
      return dir * (a.faab - b.faab);
    }
    if (key === "team") {
      return dir * a.team.localeCompare(b.team);
    }
    if (key === "season") {
      return dir * a.season.localeCompare(b.season);
    }
    if (key === "week") {
      return dir * (a.week - b.week);
    }
    // default created timestamp
    return dir * (a.created - b.created);
  });
  return sorted;
}

export async function GET(req: NextRequest) {
  const guarded = await guardPublicDataRequest(req, {
    action: 'transactions-ledger',
    requireBrowserGate: true,
    limit: { maxRequests: 30, windowSeconds: 5 * 60 },
  });
  if (guarded) return guarded;

  try {
    const url = new URL(req.url);
    const season = url.searchParams.get("season");
    const team = url.searchParams.get("team");
    const sortKey = url.searchParams.get("sort");
    const direction = url.searchParams.get("direction");

    const league = await getCurrentLeague();
    if (!league) return NextResponse.json({ error: 'No active league selected.' }, { status: 404 });
    const result = await readThroughReliabilityCache({
      key: reliabilityKey('transactions-ledger', league.id),
      freshForSeconds: 5 * 60,
      staleForSeconds: 7 * 24 * 60 * 60,
      load: () => buildTransactionLedger({ dbLeagueId: league.id }),
    });
    const ledger = result.value;
    const allSeasons = Array.from(new Set(ledger.map((txn) => txn.season))).sort((a, b) => b.localeCompare(a));
    const allTeams = Array.from(new Set(ledger.map((txn) => txn.team))).sort();

    let filtered = ledger;
    if (season && season.toLowerCase() !== "all") {
      filtered = filtered.filter((txn) => txn.season === season);
    }
    if (team && team.toLowerCase() !== "all") {
      filtered = filtered.filter((txn) => txn.team === team);
    }

    const sorted = sortTransactions(filtered, sortKey, direction);

    const summary = buildSummary(sorted);

    return NextResponse.json({
      transactions: sorted,
      summary,
      options: {
        seasons: allSeasons,
        teams: allTeams,
      },
    }, { headers: reliabilityResponseHeaders(result) });
  } catch (error) {
    console.error("/api/transactions error", error);
    return NextResponse.json({ error: "Transactions are temporarily unavailable." }, { status: 503, headers: { "Retry-After": "60" } });
  }
}

function buildSummary(transactions: Awaited<ReturnType<typeof buildTransactionLedger>>) {
  const totalsByTeam = new Map<string, number>();
  const totalsBySeason = new Map<string, number>();
  let grandTotal = 0;
  for (const txn of transactions) {
    if (txn.faab > 0) {
      grandTotal += txn.faab;
      totalsByTeam.set(txn.team, (totalsByTeam.get(txn.team) ?? 0) + txn.faab);
      totalsBySeason.set(txn.season, (totalsBySeason.get(txn.season) ?? 0) + txn.faab);
    }
  }
  return {
    totalFaab: grandTotal,
    totalsByTeam: Array.from(totalsByTeam.entries()).map(([team, faab]) => ({ team, faab })).sort((a, b) => b.faab - a.faab),
    totalsBySeason: Array.from(totalsBySeason.entries()).map(([season, faab]) => ({ season, faab })).sort((a, b) => b.season.localeCompare(a.season)),
    count: transactions.length,
  };
}
