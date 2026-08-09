import { describe, expect, it } from 'vitest';

import { createGame } from './engine.js';
import { americasMap, asiaPacificMap, grandEuropeMap } from './maps/atlas-maps.js';
import { neonCityMap } from './maps/neon-city.js';

describe('expanded atlas maps', () => {
  for (const map of [neonCityMap, grandEuropeMap, americasMap, asiaPacificMap]) {
    it(`${map.name} is a playable 32-space circuit`, () => {
      const state = createGame({
        gameId: `game-${map.id}`,
        map,
        players: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' }
        ],
        now: 1
      });
      expect(map.tiles).toHaveLength(32);
      expect(new Set(map.tiles.map((tile) => tile.id)).size).toBe(32);
      expect(Object.keys(state.properties)).toHaveLength(map.properties.length);
      expect(state.mapId).toBe(map.id);
    });
  }

  it('preserves team assignments in authoritative state', () => {
    const state = createGame({
      gameId: 'teams',
      map: americasMap,
      players: [
        { id: 'a', name: 'A', teamId: 'team-0' },
        { id: 'b', name: 'B', teamId: 'team-1' },
        { id: 'c', name: 'C', teamId: 'team-0' },
        { id: 'd', name: 'D', teamId: 'team-1' }
      ],
      rules: { victoryMode: 'TEAM_NET_WORTH' },
      now: 1
    });
    expect(state.players.a?.teamId).toBe('team-0');
    expect(state.players.c?.teamId).toBe('team-0');
    expect(state.rules.victoryMode).toBe('TEAM_NET_WORTH');
  });
});
