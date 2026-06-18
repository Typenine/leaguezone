/**
 * Shared trade analysis engine — used by both the web UI (page.tsx) and MCP tools.
 *
 * All four fixes applied:
 *   1. studScale normalization — raw * studScale fed into studMultiplier() so FC/KTC
 *      source values are compared on a 0-9999 basis before premium thresholds fire.
 *   2. Position-order penalty only applies when the asset is meaningfully below the
 *      side's best (< 85 % of bestValue).  Three equal-value starters are not penalised.
 *   3. Grade capped at A.  A+ eliminated — winner of a lopsided trade still gets A,
 *      not A+.  Only the loser of a lopsided trade descends through B+/B/C+/D.
 *   4. "Fair Trade" verdict requires ≥ 95 % ratio (tightened from 92 %).
 *      counterHint threshold raised from 80 % to 85 % to match.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradeAsset {
  value: number;
  isPick: boolean;
  age?: number;
}

export interface TradeAnalysisResult {
  rawRatio: number;
  adjustedRatio: number;
  verdict: string;
  winner: 'A' | 'B' | null;
  sideAGrade: string;
  sideBGrade: string;
  notes: string[];
  counterHint: string | null;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/** Fix 1: value passed in is raw * studScale, so thresholds fire on the
 *  normalised 0-9999 scale regardless of which source (FC/KTC/avg) is active. */
export function studMultiplier(value: number): number {
  if (value >= 8500) return 1.13;
  if (value >= 7000) return 1.09;
  if (value >= 5500) return 1.06;
  if (value >= 4000) return 1.03;
  return 1.0;
}

/** Fix 2: position-order penalty is suppressed when the asset is within 85 % of
 *  the side's best, so equally-valued starters don't get knocked down. */
export function depthDiscount(posOrder: number, rawValue: number, bestValue: number): number {
  const posDiscount = posOrder <= 2 ? 1.0 : posOrder === 3 ? 0.92 : posOrder === 4 ? 0.85 : 0.78;
  const rel = bestValue > 0 ? rawValue / bestValue : 1.0;
  const valDiscount = rel >= 0.70 ? 1.0 : rel >= 0.50 ? 0.94 : rel >= 0.30 ? 0.86 : rel >= 0.15 ? 0.74 : 0.62;
  const effectivePosPenalty = (bestValue > 0 && rawValue / bestValue >= 0.85) ? 1.0 : posDiscount;
  return Math.min(effectivePosPenalty, valDiscount);
}

/** Effective value of one side of a trade.
 *
 * @param assets   Assets on this side (pre-resolved to a single numeric value each).
 * @param studScale  9999 / maxRawInSource — normalises source-specific ranges so
 *                   the studMultiplier thresholds fire consistently.  Pass 1 when
 *                   values are already on a 0-9999 scale. */
export function effectiveTotal(assets: TradeAsset[], studScale: number = 1): number {
  if (!assets.length) return 0;
  const sorted = [...assets].sort((a, b) => b.value - a.value);
  const best = sorted[0].value;
  return sorted.reduce((sum, asset, i) => {
    const raw = asset.value;
    return sum + raw * studMultiplier(raw * studScale) * depthDiscount(i + 1, raw, best);
  }, 0);
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

/** Fix 3: A+ eliminated.  Winner always caps at A regardless of lopsidedness. */
export function getGradeLetter(ratio: number, isWinner: boolean): string {
  if (ratio >= 0.95) return 'A';
  if (isWinner) return 'A';
  if (ratio >= 0.85) return 'B+';
  if (ratio >= 0.70) return 'B';
  if (ratio >= 0.55) return 'C+';
  return 'D';
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/** Analyse a two-sided dynasty trade.
 *
 * @param sideA     Assets received by team A (each already resolved to a single `value`).
 * @param sideB     Assets received by team B.
 * @param studScale 9999 / maxRawInSource.  Compute once per data set:
 *                  `const studScale = maxRaw > 0 ? 9999 / maxRaw : 1;`
 */
export function analyzeTrade(
  sideA: TradeAsset[],
  sideB: TradeAsset[],
  studScale: number = 1,
): TradeAnalysisResult {
  const rawTotalA = sideA.reduce((s, a) => s + a.value, 0);
  const rawTotalB = sideB.reduce((s, a) => s + a.value, 0);

  if (sideA.length === 0 || sideB.length === 0 || (rawTotalA === 0 && rawTotalB === 0)) {
    return {
      rawRatio: 1, adjustedRatio: 1, verdict: 'Add assets to analyze', winner: null,
      sideAGrade: '—', sideBGrade: '—', notes: [], counterHint: null,
    };
  }

  const effA = effectiveTotal(sideA, studScale);
  const effB = effectiveTotal(sideB, studScale);
  const rawRatio = Math.min(effA, effB) / Math.max(effA, effB, 1);
  const notes: string[] = [];
  let adjustedRatio = rawRatio;

  const bestA = sideA.length > 0 ? Math.max(...sideA.map((a) => a.value)) : 0;
  const bestB = sideB.length > 0 ? Math.max(...sideB.map((a) => a.value)) : 0;
  const bestSide = bestA >= bestB ? 'A' : 'B';
  if (Math.abs(bestA - bestB) > 1000) {
    if ((bestSide === 'A' && effA >= effB) || (bestSide === 'B' && effB >= effA))
      adjustedRatio = Math.max(0, adjustedRatio - 0.03);
    notes.push(`Side ${bestSide} gets the best player in the deal`);
  }

  const pieceDiff = Math.abs(sideA.length - sideB.length);
  if (pieceDiff >= 1) {
    adjustedRatio = Math.min(1.0, adjustedRatio + Math.min(0.09, pieceDiff * 0.03));
    notes.push(`Side ${sideA.length < sideB.length ? 'A' : 'B'} consolidates talent (fewer pieces)`);
  }

  const picksA = sideA.filter((a) => a.isPick).length;
  const picksB = sideB.filter((a) => a.isPick).length;
  if (picksA !== picksB) notes.push(`Side ${picksA > picksB ? 'A' : 'B'} acquires more draft capital`);

  const agesA = sideA.filter((a) => !a.isPick && (a.age ?? 0) > 0).map((a) => a.age!);
  const agesB = sideB.filter((a) => !a.isPick && (a.age ?? 0) > 0).map((a) => a.age!);
  const avgAgeA = agesA.length ? agesA.reduce((s, x) => s + x, 0) / agesA.length : null;
  const avgAgeB = agesB.length ? agesB.reduce((s, x) => s + x, 0) / agesB.length : null;
  if (avgAgeA !== null && avgAgeB !== null && Math.abs(avgAgeA - avgAgeB) >= 2)
    notes.push(`Side ${avgAgeA < avgAgeB ? 'A' : 'B'} gets younger (avg ${Math.min(avgAgeA, avgAgeB).toFixed(1)} vs ${Math.max(avgAgeA, avgAgeB).toFixed(1)})`);

  const winner: 'A' | 'B' | null = effA > effB ? 'A' : effB > effA ? 'B' : null;
  const diff = Math.abs(rawTotalA - rawTotalB);

  // Fix 4: 'Fair Trade' requires ≥ 95 % (tightened from 92 %).
  let verdict: string;
  if (adjustedRatio >= 0.95) verdict = 'Fair Trade';
  else if (adjustedRatio >= 0.85) verdict = 'Slight Edge';
  else if (adjustedRatio >= 0.70) verdict = 'Uneven';
  else verdict = 'One-Sided';

  const sideAGrade = getGradeLetter(adjustedRatio, winner === 'A' || winner === null);
  const sideBGrade = getGradeLetter(adjustedRatio, winner === 'B' || winner === null);

  // Fix 4: counterHint threshold raised from 0.80 → 0.85 to match verdict bands.
  let counterHint: string | null = null;
  if (adjustedRatio < 0.85 && winner && diff > 0)
    counterHint = `Side ${winner === 'A' ? 'B' : 'A'} is short ~${diff.toLocaleString()} pts. Adding or swapping a player would help balance this.`;

  return { rawRatio, adjustedRatio, verdict, winner, sideAGrade, sideBGrade, notes, counterHint };
}
