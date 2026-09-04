'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Label from '@/components/ui/Label';
import {
  getReadableTextColor,
  normalizeBrandPalette,
  normalizeHexColor,
  type BrandPalette,
} from '@/lib/branding/colors';

type TeamColor = BrandPalette;

type Team = {
  rosterId: number;
  teamName: string;
  ownerName: string;
  colors: TeamColor;
};

const DEFAULT_COLORS: TeamColor = {
  primary: '#1a1a2e',
  secondary: '#16213e',
};

export default function SetupTeamsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  useEffect(() => {
    async function loadTeams() {
      try {
        const res = await fetch('/api/setup/teams', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.teams) {
            const savedColors = (data.teamColors || {}) as Record<string, unknown>;
            setTeams(data.teams.map((t: { rosterId: number; teamName: string; ownerName: string }) => ({
              ...t,
              colors: normalizeBrandPalette(savedColors[t.teamName]) || { ...DEFAULT_COLORS },
            })));
          }
        }
      } catch {
        // Teams not loaded yet
      }
    }
    loadTeams();
  }, []);

  const handleColorChange = (teamIndex: number, colorKey: keyof TeamColor, value: string) => {
    setTeams(prev => prev.map((team, i) => 
      i === teamIndex 
        ? { ...team, colors: { ...team.colors, [colorKey]: value } }
        : team
    ));
    setError(null);
  };

  const handleSubmit = async () => {
    const teamColors: Record<string, TeamColor> = {};
    for (const team of teams) {
      const palette = normalizeBrandPalette(team.colors);
      if (!palette) {
        setError(`Check the colors for ${team.teamName}. Use hex colors such as #0b5f98.`);
        return;
      }
      teamColors[team.teamName] = palette;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/setup/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamColors }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save team colors');
      }

      router.push('/setup/rules');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/setup/rules');
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/setup')}
            className="text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to overview
          </button>
        </div>

        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent)] text-lg font-bold mb-4"
            style={{ color: 'var(--on-accent, #ffffff)' }}
          >
            4
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)] mb-2">
            Team Colors
          </h1>
          <p className="text-[var(--muted)]">
            Customize colors for each team (optional)
          </p>
        </div>

        <Card className="p-6">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {teams.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)]">
              <p>No teams found. Please complete the Sleeper integration step first.</p>
              <Button
                variant="secondary"
                onClick={() => router.push('/setup/sleeper')}
                className="mt-4"
              >
                Go to Sleeper Setup
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team, index) => {
                const primary = normalizeHexColor(team.colors.primary);
                const secondary = normalizeHexColor(team.colors.secondary);
                const tertiary = normalizeHexColor(team.colors.tertiary);
                const quaternary = normalizeHexColor(team.colors.quaternary);

                return (
                  <div
                    key={team.rosterId}
                    className="border border-[var(--border)] rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedTeam(expandedTeam === index ? null : index)}
                      className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface)] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex gap-1 shrink-0">
                          <div
                            className="w-4 h-8 rounded-sm border border-black/10"
                            style={{ backgroundColor: primary || DEFAULT_COLORS.primary }}
                          />
                          <div
                            className="w-4 h-8 rounded-sm border border-black/10"
                            style={{ backgroundColor: secondary || DEFAULT_COLORS.secondary }}
                          />
                        </div>
                        <div className="text-left min-w-0">
                          <div className="font-medium text-[var(--text)] truncate">{team.teamName}</div>
                          <div className="text-xs text-[var(--muted)] truncate">{team.ownerName}</div>
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 shrink-0 text-[var(--muted)] transition-transform ${
                          expandedTeam === index ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {expandedTeam === index && (
                      <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {([
                            ['primary', 'Primary', false, '#1a1a2e'],
                            ['secondary', 'Secondary', false, '#16213e'],
                            ['tertiary', 'Tertiary (optional)', true, '#333333'],
                            ['quaternary', 'Quaternary (optional)', true, '#444444'],
                          ] as const).map(([key, label, optional, fallback]) => {
                            const raw = team.colors[key] || '';
                            const normalized = normalizeHexColor(raw);
                            const invalid = !optional ? !normalized : Boolean(raw && !normalized);
                            return (
                              <div key={key}>
                                <Label>{label}</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <input
                                    type="color"
                                    value={normalized || fallback}
                                    onChange={(e) => handleColorChange(index, key, e.target.value)}
                                    className="w-10 h-10 shrink-0 rounded cursor-pointer border border-[var(--border)]"
                                  />
                                  <input
                                    type="text"
                                    value={raw}
                                    onChange={(e) => handleColorChange(index, key, e.target.value)}
                                    placeholder={fallback}
                                    aria-invalid={invalid}
                                    className={`min-w-0 flex-1 px-2 py-1 rounded bg-[var(--background)] border text-[var(--text)] text-sm ${invalid ? 'border-red-500' : 'border-[var(--border)]'}`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 p-3 rounded-lg border border-[var(--border)]">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <p className="text-xs text-[var(--muted)]">Accessible preview</p>
                            <p className="text-xs text-[var(--muted)]">Text adjusts automatically</p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {([
                              ['Primary', primary],
                              ['Secondary', secondary],
                              ['Tertiary', tertiary],
                              ['Quaternary', quaternary],
                            ] as const).map(([label, color]) => color ? (
                              <div
                                key={label}
                                className="min-h-12 rounded flex items-center justify-center px-2 text-xs font-semibold text-center"
                                style={{ backgroundColor: color, color: getReadableTextColor(color) }}
                              >
                                {label}
                              </div>
                            ) : null)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-6 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push('/setup/branding')}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSkip}
              className="flex-1"
            >
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || teams.length === 0}
              className="flex-1"
            >
              {loading ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
