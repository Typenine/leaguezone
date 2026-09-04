export type BrandPalette = {
  primary: string;
  secondary: string;
  tertiary?: string;
  quaternary?: string;
};

export type SemanticBrandTokens = {
  accent: string;
  secondaryAccent: string;
  highlight: string;
  borderHighlight: string;
  onAccent: '#ffffff' | '#000000';
  onSecondaryAccent: '#ffffff' | '#000000';
  chartColors: string[];
};

const SHORT_HEX = /^#([0-9a-f]{3})$/i;
const LONG_HEX = /^#([0-9a-f]{6})$/i;

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const short = trimmed.match(SHORT_HEX);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (!LONG_HEX.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function isHexColor(value: unknown): value is string {
  return normalizeHexColor(value) !== null;
}

function srgbChannelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color: string): number {
  const normalized = normalizeHexColor(color);
  if (!normalized) return 0;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return (
    0.2126 * srgbChannelToLinear(red)
    + 0.7152 * srgbChannelToLinear(green)
    + 0.0722 * srgbChannelToLinear(blue)
  );
}

export function contrastRatio(first: string, second: string): number {
  const firstLum = relativeLuminance(first);
  const secondLum = relativeLuminance(second);
  const lighter = Math.max(firstLum, secondLum);
  const darker = Math.min(firstLum, secondLum);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Choose the higher-contrast black/white foreground for a solid brand color. */
export function getReadableTextColor(background: string): '#ffffff' | '#000000' {
  const normalized = normalizeHexColor(background);
  if (!normalized) return '#ffffff';
  const light = '#ffffff';
  const dark = '#000000';
  return contrastRatio(normalized, dark) >= contrastRatio(normalized, light) ? dark : light;
}

export function normalizeBrandPalette(value: unknown): BrandPalette | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const palette = value as Record<string, unknown>;
  const primary = normalizeHexColor(palette.primary);
  const secondary = normalizeHexColor(palette.secondary);
  if (!primary || !secondary) return null;

  const tertiary = palette.tertiary == null || palette.tertiary === ''
    ? undefined
    : normalizeHexColor(palette.tertiary);
  const quaternary = palette.quaternary == null || palette.quaternary === ''
    ? undefined
    : normalizeHexColor(palette.quaternary);

  if (tertiary === null || quaternary === null) return null;
  return {
    primary,
    secondary,
    ...(tertiary ? { tertiary } : {}),
    ...(quaternary ? { quaternary } : {}),
  };
}

export function deriveSemanticBrandTokens(palette: BrandPalette): SemanticBrandTokens {
  const normalized = normalizeBrandPalette(palette) || { primary: '#0b5f98', secondary: '#be161e' };
  const highlight = normalized.tertiary || normalized.secondary;
  const borderHighlight = normalized.quaternary || normalized.primary;
  return {
    accent: normalized.primary,
    secondaryAccent: normalized.secondary,
    highlight,
    borderHighlight,
    onAccent: getReadableTextColor(normalized.primary),
    onSecondaryAccent: getReadableTextColor(normalized.secondary),
    chartColors: [
      normalized.primary,
      normalized.secondary,
      ...(normalized.tertiary ? [normalized.tertiary] : []),
      ...(normalized.quaternary ? [normalized.quaternary] : []),
    ],
  };
}

export function normalizeBrandImageUrl(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}
