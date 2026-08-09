import { describe, expect, it } from 'vitest';

import { neonCityProperties, neonCityTiles } from './neon-city';

describe('World Capitals visual projection', () => {
  it('projects every authoritative tile exactly once', () => {
    expect(neonCityTiles).toHaveLength(32);
    expect(new Set(neonCityTiles.map((tile) => tile.id)).size).toBe(32);
  });

  it('never invents a client-side price for a non-property tile', () => {
    for (const tile of neonCityTiles) {
      if (tile.kind === 'PROPERTY') expect(neonCityProperties.has(tile.id)).toBe(true);
      else expect(tile.price).toBeUndefined();
    }
  });
});
