'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import AnalyzerTradeImpact, {type ConnectedTradeRosterContext} from '@/components/fantasy/AnalyzerTradeImpact';
import type { TradeValue } from '@/lib/types/trade-analyzer';

type ValueSource = 'avg' | 'ktc' | 'fc';

// --- Types ---

interface SelectedAsset {
  key: string;
  name: string;
  position: string;
  nflTeam: string;
  value: number;
  fcValue: number | null;
  ktcValue: number | null;
  age?: number;
  trend: number;
  isPick: boolean;
}

interface AnalysisResult {
  rawRatio: number;
  adjustedRatio: number;
  verdict: string;
  winner: 'A' | 'B' | null;
  diff: number;
  sideAGrade: string;
  sideBGrade: string;
  notes: string[];
  counterHint: string | null;
  displayAdjA: number;
  displayAdjB: number;
  showAdjA: boolean;
  showAdjB: boolean;
  rawTotalA: number;
  rawTotalB: number;
}

// --- Value & adjustment helpers ---

function getDisplayValue(asset: SelectedAsset, source: ValueSource): number {
  if (source === 'fc') return asset.fcValue ?? asset.value;
  if (source === 'ktc') return asset.ktcValue ?? asset.value;
  return asset.value;
}

function studMultiplier(value: number): number {
  if (value >= 8500) return 1.13;
  if (value >= 7000) return 1.09;
  if (value >= 5500) return 1.06;
  if (value >= 4000) return 1.03;
  return 1.0;
}

function depthDiscount(posOrder: number, r¶»§q«^