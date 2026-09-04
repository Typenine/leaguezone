import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  getReadableTextColor,
  normalizeBrandPalette,
  normalizeHexColor,
} from './colors';

describe('branding color utilities', () => {
  it('normalizes short and long hex colors', () => {
    expect(normalizeHexColor('#ABC')).toBe('#aabbcc');
    expect(normalizeHexColor(' #AABBCC ')).toBe('#aabbcc');
    expect(normalizeHexColor('red')).toBeNull();
    expect(normalizeHexColor('#abcd')).toBeNull();
  });

  it('chooses readable text for light and dark backgrounds', () => {
    expect(getReadableTextColor('#ffffff')).toBe('#111827');
    expect(getReadableTextColor('#facc15')).toBe('#111827');
    expect(getReadableTextColor('#000000')).toBe('#ffffff');
    expect(getReadableTextColor('#0b5f98')).toBe('#ffffff');
  });

  it('keeps the chosen foreground at WCAG AA contrast for representative colors', () => {
    for (const background of ['#ffffff', '#000000', '#facc15', '#5aaddb', '#0b5f98', '#7b1c2e', '#909090', '#ffff00', '#00ffff', '#ff69b4']) {
      const foreground = getReadableTextColor(background);
      expect(contrastRatio(background, foreground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('normalizes complete team palettes and rejects invalid colors', () => {
    expect(normalizeBrandPalette({ primary: '#ABC', secondary: '#123456', tertiary: '' })).toEqual({
      primary: '#aabbcc',
      secondary: '#123456',
    });
    expect(normalizeBrandPalette({ primary: '#123456', secondary: 'blue' })).toBeNull();
  });
});
