// Unit tests for the Thumbnail SPIKE (Phase 2.8).
// Verifies the MediaEngine adapter contract (ADR-0012) and that Channel
// visual_identity drives a DIFFERENT visual direction (palette -> bg color).
import { describe, it, expect } from 'vitest';
import { getThumbnailEngine, listThumbnailEngines } from '../src/thumbnail-engine.js';
import { paletteToColor, styleToTextColor } from '../src/thumbnail.js';

describe('thumbnail engine registry (MediaEngine adapter)', () => {
  it('registers the local ffmpeg thumbnail engine', () => {
    const engines = listThumbnailEngines();
    expect(engines).toContainEqual({ provider: 'local', model: 'ffmpeg' });
  });

  it('returns the ffmpeg engine by default and by explicit provider', () => {
    expect(getThumbnailEngine(undefined, undefined).provider).toBe('local');
    expect(getThumbnailEngine('local', 'ffmpeg').model).toBe('ffmpeg');
  });

  it('falls back to ffmpeg for an unknown provider', () => {
    expect(getThumbnailEngine('unknown', 'x').provider).toBe('local');
  });
});

describe('Channel visual_identity -> visual direction', () => {
  it('maps Facts palette (soft blue) to a blue background', () => {
    expect(paletteToColor('soft blue / white / gray')).toBe('0x1e3a8a');
  });

  it('maps Sports palette (black / neon green) to a black background', () => {
    expect(paletteToColor('black / neon green / white')).toBe('0x0a0a0a');
  });

  it('produces DIFFERENT background colors for Facts vs Sports', () => {
    const facts = paletteToColor('soft blue / white / gray');
    const sports = paletteToColor('black / neon green / white');
    expect(facts).not.toBe(sports);
  });

  it('maps high-contrast style to neon text on dark backgrounds', () => {
    expect(styleToTextColor('bold, high-contrast, dynamic', '0x0a0a0a')).toBe('0x00ff66');
  });

  it('maps muted style to white text on dark backgrounds', () => {
    expect(styleToTextColor('clean, minimal, muted tones', '0x1e3a8a')).toBe('0xffffff');
  });
});
