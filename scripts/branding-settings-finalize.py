from pathlib import Path

path = Path('src/app/settings/SettingsContent.tsx')
source = path.read_text()

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

source = replace_once(
    source,
    "import { DefaultTeamHelmet, HELMET_PALETTE } from '@/components/ui/DefaultTeamHelmet';",
    "import { DefaultTeamHelmet, HELMET_PALETTE } from '@/components/ui/DefaultTeamHelmet';\nimport { getReadableTextColor, normalizeHexColor } from '@/lib/branding/colors';",
    'branding utility import',
)

marker = "// ─── PIN change form (for logged-in users) ───────────────────────────────────"
helper = '''function BrandColorPreview({ label, color }: { label: string; color: string }) {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return (
      <div className="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
        Enter a valid hex color
      </div>
    );
  }
  return (
    <div
      className="mt-2 rounded px-3 py-2 text-center text-xs font-bold"
      style={{ backgroundColor: normalized, color: getReadableTextColor(normalized) }}
    >
      {label} preview
    </div>
  );
}

'''
source = replace_once(source, marker, helper + marker, 'brand preview helper')

league_start = source.index('function LeagueBrandingForm()')
league_end = source.index('// ─── User: team profile editor', league_start)
league = source[league_start:league_end]

league = replace_once(
    league,
    "    e.preventDefault();\n    setStatus('saving');",
    '''    e.preventDefault();
    const normalizedPrimary = normalizeHexColor(primaryColor);
    const normalizedSecondary = normalizeHexColor(secondaryColor);
    if (!normalizedPrimary || !normalizedSecondary) {
      setStatus('error');
      setMsg('Primary and secondary colors must be valid hex colors.');
      return;
    }
    setPrimaryColor(normalizedPrimary);
    setSecondaryColor(normalizedSecondary);
    setStatus('saving');''',
    'league client validation',
)
league = replace_once(
    league,
    "    if (res.ok) { setStatus('ok'); setMsg('Branding saved'); }",
    '''    if (res.ok) {
      const runtimeWindow = window as Window & { __LEAGUE_BRANDING__?: Record<string, unknown> };
      runtimeWindow.__LEAGUE_BRANDING__ = {
        ...(runtimeWindow.__LEAGUE_BRANDING__ || {}),
        logoUrl: logoUrl.trim() || null,
        primaryColor: normalizeHexColor(primaryColor),
        secondaryColor: normalizeHexColor(secondaryColor),
      };
      window.dispatchEvent(new Event('leaguezone:league-changed'));
      setStatus('ok');
      setMsg('Branding saved');
    }''',
    'league live refresh',
)
league = league.replace('className="grid grid-cols-2 gap-4"', 'className="grid grid-cols-1 gap-4 sm:grid-cols-2"', 1)
league = replace_once(
    league,
    'type="color"\n              value={primaryColor}',
    "type=\"color\"\n              value={normalizeHexColor(primaryColor) || '#000000'}",
    'league primary color picker',
)
league = replace_once(
    league,
    'type="color"\n              value={secondaryColor}',
    "type=\"color\"\n              value={normalizeHexColor(secondaryColor) || '#000000'}",
    'league secondary color picker',
)
league = replace_once(
    league,
    '<div className="mt-2 h-6 rounded" style={{ backgroundColor: primaryColor }} />',
    '<BrandColorPreview label="Primary" color={primaryColor} />',
    'league primary preview',
)
league = replace_once(
    league,
    '<div className="mt-2 h-6 rounded" style={{ backgroundColor: secondaryColor }} />',
    '<BrandColorPreview label="Secondary" color={secondaryColor} />',
    'league secondary preview',
)
source = source[:league_start] + league + source[league_end:]

team_start = source.index('function TeamProfileForm')
team_end = source.index('// ─── Admin: Discord webhooks', team_start)
team = source[team_start:team_end]

team = replace_once(
    team,
    "  const [secondaryColor, setSecondaryColor] = useState('#1e40af');",
    "  const [secondaryColor, setSecondaryColor] = useState('#1e40af');\n  const [tertiaryColor, setTertiaryColor] = useState('');\n  const [quaternaryColor, setQuaternaryColor] = useState('');",
    'team optional color state',
)
team = replace_once(
    team,
    "      if (d.secondaryColor) setSecondaryColor(d.secondaryColor);\n      if (typeof d.helmetColorIndex === 'number') setHelmetColorIndex(d.helmetColorIndex);",
    "      if (d.secondaryColor) setSecondaryColor(d.secondaryColor);\n      setTertiaryColor(d.tertiaryColor || '');\n      setQuaternaryColor(d.quaternaryColor || '');\n      if (typeof d.helmetColorIndex === 'number') setHelmetColorIndex(d.helmetColorIndex);",
    'team optional color load',
)
team = replace_once(
    team,
    "    e.preventDefault();\n    setStatus('saving');",
    '''    e.preventDefault();
    const normalizedPrimary = normalizeHexColor(primaryColor);
    const normalizedSecondary = normalizeHexColor(secondaryColor);
    const normalizedTertiary = tertiaryColor.trim() ? normalizeHexColor(tertiaryColor) : null;
    const normalizedQuaternary = quaternaryColor.trim() ? normalizeHexColor(quaternaryColor) : null;
    if (!normalizedPrimary || !normalizedSecondary || (tertiaryColor.trim() && !normalizedTertiary) || (quaternaryColor.trim() && !normalizedQuaternary)) {
      setStatus('error');
      setMsg('Use valid hex colors. Tertiary and quaternary may be left blank.');
      return;
    }
    setPrimaryColor(normalizedPrimary);
    setSecondaryColor(normalizedSecondary);
    if (normalizedTertiary) setTertiaryColor(normalizedTertiary);
    if (normalizedQuaternary) setQuaternaryColor(normalizedQuaternary);
    setStatus('saving');''',
    'team client validation',
)
team = replace_once(
    team,
    "        secondaryColor,\n        helmetColorIndex,",
    "        secondaryColor,\n        tertiaryColor: tertiaryColor.trim() || null,\n        quaternaryColor: quaternaryColor.trim() || null,\n        helmetColorIndex,",
    'team full palette submit',
)
team = replace_once(
    team,
    "    if (res.ok) { setStatus('ok'); setMsg('Team profile saved'); }",
    '''    if (res.ok) {
      window.dispatchEvent(new Event('leaguezone:league-changed'));
      setStatus('ok');
      setMsg('Team profile saved');
    }''',
    'team live refresh',
)

old_grid = '''      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="team-primary-color">Primary Color</Label>
          <div className="flex items-center gap-2 mt-1">
            <input id="team-primary-color" type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-[var(--border)]" />
            <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" placeholder="#3b82f6" />
          </div>
        </div>
        <div>
          <Label htmlFor="team-secondary-color">Secondary Color</Label>
          <div className="flex items-center gap-2 mt-1">
            <input id="team-secondary-color" type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-[var(--border)]" />
            <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1" placeholder="#1e40af" />
          </div>
        </div>
      </div>'''
new_grid = '''      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="team-primary-color">Primary Color</Label>
          <div className="mt-1 flex items-center gap-2">
            <input id="team-primary-color" type="color" value={normalizeHexColor(primaryColor) || '#000000'} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-[var(--border)]" />
            <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" placeholder="#3b82f6" />
          </div>
          <BrandColorPreview label="Primary" color={primaryColor} />
        </div>
        <div>
          <Label htmlFor="team-secondary-color">Secondary Color</Label>
          <div className="mt-1 flex items-center gap-2">
            <input id="team-secondary-color" type="color" value={normalizeHexColor(secondaryColor) || '#000000'} onChange={e => setSecondaryColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-[var(--border)]" />
            <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1" placeholder="#1e40af" />
          </div>
          <BrandColorPreview label="Secondary" color={secondaryColor} />
        </div>
        <div>
          <Label htmlFor="team-tertiary-color">Tertiary Color (optional)</Label>
          <div className="mt-1 flex items-center gap-2">
            <input id="team-tertiary-color" type="color" value={normalizeHexColor(tertiaryColor) || '#333333'} onChange={e => setTertiaryColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-[var(--border)]" />
            <Input value={tertiaryColor} onChange={e => setTertiaryColor(e.target.value)} className="flex-1" placeholder="Optional" />
          </div>
          {tertiaryColor.trim() && <BrandColorPreview label="Tertiary" color={tertiaryColor} />}
        </div>
        <div>
          <Label htmlFor="team-quaternary-color">Quaternary Color (optional)</Label>
          <div className="mt-1 flex items-center gap-2">
            <input id="team-quaternary-color" type="color" value={normalizeHexColor(quaternaryColor) || '#444444'} onChange={e => setQuaternaryColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-[var(--border)]" />
            <Input value={quaternaryColor} onChange={e => setQuaternaryColor(e.target.value)} className="flex-1" placeholder="Optional" />
          </div>
          {quaternaryColor.trim() && <BrandColorPreview label="Quaternary" color={quaternaryColor} />}
        </div>
      </div>'''
team = replace_once(team, old_grid, new_grid, 'team full palette controls')
source = source[:team_start] + team + source[team_end:]

path.write_text(source)
