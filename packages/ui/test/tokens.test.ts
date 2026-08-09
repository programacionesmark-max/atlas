import { describe, expect, it } from 'vitest';

import { designTokens } from '../src/tokens.js';

describe('design tokens', () => {
  it('uses valid hex colors and increasing motion durations', () => {
    expect(Object.values(designTokens.color).every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(
      true
    );
    expect(designTokens.motion.fast).toBeLessThan(designTokens.motion.standard);
    expect(designTokens.motion.standard).toBeLessThan(designTokens.motion.deliberate);
  });
});
