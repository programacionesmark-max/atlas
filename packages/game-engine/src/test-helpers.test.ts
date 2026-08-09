import { describe, expect, it } from 'vitest';
import { createGame, defaultRules } from './engine.js';
import { GameRuleError } from './errors.js';
import { validateMapConfig } from './map.js';
import { neonCityMap } from './maps/neon-city.js';

describe('game creation and map validation', () => {
  it('creates a complete lobby with a property state and auditable starting balances', () => {
    const state = createGame({
      gameId: 'g1',
      map: neonCityMap,
      players: [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Bo' }
      ],
      now: 100
    });
    expect(state.phase).toBe('LOBBY');
    expect(state.players.a?.cash).toBe(neonCityMap.economy.startingCash);
    expect(Object.keys(state.properties)).toHaveLength(neonCityMap.properties.length);
    expect(state.transactions).toHaveLength(2);
    expect(state.transactions.every((entry) => entry.type === 'STARTING_CASH')).toBe(true);
  });

  it('merges rule overrides over map-specific defaults', () => {
    expect(defaultRules(neonCityMap).salaryOnPassStart).toBe(300);
    const state = createGame({
      gameId: 'g2',
      map: neonCityMap,
      players: [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Bo' }
      ],
      now: 100,
      rules: { startingCash: 999, auctionsEnabled: false }
    });
    expect(state.rules.startingCash).toBe(999);
    expect(state.rules.auctionsEnabled).toBe(false);
  });

  it('rejects broken map paths', () => {
    const broken = {
      ...neonCityMap,
      tiles: neonCityMap.tiles.map((tile, index) =>
        index === 0 ? { ...tile, next: ['missing'] } : tile
      )
    };
    expect(() => validateMapConfig(broken)).toThrow(GameRuleError);
  });
});
