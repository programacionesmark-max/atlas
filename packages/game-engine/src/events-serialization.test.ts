import { describe, expect, it } from 'vitest';
import { applyGameAction, createGame } from './engine.js';
import { EVENT_DEFINITIONS } from './events/events.js';
import { neonCityMap } from './maps/neon-city.js';
import { SequenceRandomSource } from './random.js';
import { cloneGameState, deserializeGameState, serializeGameState } from './serialization.js';
import type { EngineContext } from './types.js';

let id = 0;
const context = (rolls: readonly number[]): EngineContext => ({
  now: 1_000 + id,
  random: new SequenceRandomSource(rolls),
  idFactory: () => `event-${++id}`
});

describe('events', () => {
  it('ships more than forty original, uniquely-addressable events', () => {
    expect(EVENT_DEFINITIONS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(EVENT_DEFINITIONS.map((event) => event.id)).size).toBe(EVENT_DEFINITIONS.length);
  });

  it('draws and applies an event from the configured deterministic deck', () => {
    let state = createGame({
      gameId: 'event-game',
      map: neonCityMap,
      players: [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Bo' }
      ],
      now: 1,
      eventDeck: ['crypto-boom']
    });
    state = applyGameAction(
      state,
      { type: 'START_GAME', actorId: 'a' },
      neonCityMap,
      context([1, 1])
    );
    const cash = state.players.a?.cash ?? 0;
    state = applyGameAction(
      state,
      { type: 'ROLL_DICE', actorId: 'a' },
      neonCityMap,
      context([1, 1])
    );
    expect(state.players.a?.positionTileId).toBe('signal-event');
    expect(state.players.a?.cash).toBe(cash + 550);
    expect(state.transactions.at(-1)?.metadata).toMatchObject({ eventId: 'crypto-boom' });
    expect(state.phase).toBe('TURN_END');
  });
});

describe('snapshot serialization', () => {
  it('round-trips a state without sharing references', () => {
    const state = createGame({
      gameId: 'snapshot',
      map: neonCityMap,
      players: [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Bo' }
      ],
      now: 1
    });
    const restored = deserializeGameState(serializeGameState(state), neonCityMap);
    expect(restored).toEqual(state);
    expect(restored).not.toBe(state);
    expect(cloneGameState(state)).toEqual(state);
  });

  it('rejects unknown versions and mismatched maps', () => {
    expect(() => deserializeGameState('{"schemaVersion":99}')).toThrow(/Unsupported/);
    const state = createGame({
      gameId: 'snapshot',
      map: neonCityMap,
      players: [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Bo' }
      ],
      now: 1
    });
    expect(() =>
      deserializeGameState(serializeGameState(state), { ...neonCityMap, id: 'other' })
    ).toThrow(/does not match/);
  });
});
