'use client';

import { useLayoutEffect } from 'react';

/**
 * The shared legacy analyzer still renders a single-league format caption.
 * Canonical hosted routes replace only that caption with the resolved league
 * format while the analyzer itself continues to use the scoped values endpoint.
 */
export default function LeagueTradeAnalyzerFormatLabel({ label }: { label: string | null }) {
  useLayoutEffect(() => {
    if (!label) return;
    const root = document.getElementById('league-trade-analyzer');
    if (!root) return;
    const heading = Array.from(root.querySelectorAll('h1')).find((node) => node.textContent?.trim() === 'Trade Analyzer');
    const caption = heading?.nextElementSibling;
    if (caption instanceof HTMLParagraphElement) {
      caption.textContent = label;
      caption.dataset.leagueFormat = 'true';
    }
  }, [label]);

  return null;
}
