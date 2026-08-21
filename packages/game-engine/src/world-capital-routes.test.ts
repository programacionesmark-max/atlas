import { describe, expect, it } from 'vitest';

import { calculateRent } from './economy.js';
import { applyGameAction, createGame } from './engine.js';
import { worldCapitalRoutesMap } from './maps/world-capital-routes.js';
import { SequenceRandomSource } from './random.js';
import type { EngineContext, GameState, PropertyState } from './types.js';

let id = 0;
let now = 20_000;

function context(rolls: readonly number[] = [4, 4]): EngineContext {
  return {
    now: now++,
    random: new SequenceRandomSource(rolls),
    idFactory: () => `world-id-${++id}`
  };
}

function fresh(): GameState {
  return createGame({
    gameId: `world-game-${++id}`,
    map: worldCapitalRoutesMap,
    players: [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bo' }
    ],
    now: now++
  });
}

function start(): GameState {
  return applyGameAction(
    fresh(),
    { type: 'START_GAME', actorId: 'a' },
    worldCapitalRoutesMap,
    context()
  );
}

describe('world route movement and paid flight decisions', () => {
  it('pauses step-by-step movement when the roll crosses an airport', () => {
    const state = applyGameAction(
      start(),
      { type: 'ROLL_DICE', actorId: 'a' },
      worldCapitalRoutesMap,
      context([5, 5])
    );

    expect(state.phase).toBe('FLIGHT_DECISION');
    expect(state.players.a?.positionTileId).toBe('europe-airport');
    expect(state.pendingFlightDecision).toMatchObject({
      playerId: 'a',
      airportTileId: 'europe-airport',
      remainingSteps: 2
    });
    expect(state.lastMovement?.tileIds).toEqual([
      'world-start',
      'london',
      'manchester',
      'birmingham',
      'europe-news',
      'paris',
      'lyon',
      'marseille',
      'europe-airport'
    ]);
  });

  it('charges the selected flight and then consumes the remaining dice steps', () => {
    let state = applyGameAction(
      start(),
      { type: 'ROLL_DICE', actorId: 'a' },
      worldCapitalRoutesMap,
      context([5, 5])
    );
    const cash = state.players.a?.cash ?? 0;

    state = applyGameAction(
      state,
      { type: 'TAKE_FLIGHT', actorId: 'a', destinationTileId: 'new-york' },
      worldCapitalRoutesMap,
      context()
    );

    expect(state.players.a?.cash).toBe(cash - 240);
    expect(state.players.a?.positionTileId).toBe('toronto');
    expect(state.phase).toBe('PROPERTY_DECISION');
    expect(state.transactions.at(-1)?.type).toBe('FLIGHT');
    expect(state.lastMovement).toMatchObject({
      mode: 'FLIGHT',
      tileIds: ['europe-airport', 'new-york', 'passport-control', 'toronto']
    });
  });

  it('continues the ground route without charging when the flight is declined', () => {
    let state = applyGameAction(
      start(),
      { type: 'ROLL_DICE', actorId: 'a' },
      worldCapitalRoutesMap,
      context([5, 5])
    );
    const cash = state.players.a?.cash ?? 0;

    state = applyGameAction(
      state,
      { type: 'DECLINE_FLIGHT', actorId: 'a' },
      worldCapitalRoutesMap,
      context()
    );

    expect(state.players.a?.cash).toBe(cash);
    expect(state.players.a?.positionTileId).toBe('barcelona');
    expect(state.phase).toBe('PROPERTY_DECISION');
    expect(state.lastMovement?.tileIds).toEqual(['europe-airport', 'madrid', 'barcelona']);
  });
});

describe('country portfolios and development', () => {
  it('defines every country as a collectible portfolio of two or three cities', () => {
    const groups = new Map<string, number>();
    for (const property of worldCapitalRoutesMap.properties)
      groups.set(property.group, (groups.get(property.group) ?? 0) + 1);

    expect(worldCapitalRoutesMap.properties).toHaveLength(40);
    expect(groups.size).toBe(16);
    expect([...groups.values()].every((size) => size === 2 || size === 3)).toBe(true);
    expect([...groups.values()].filter((size) => size === 3)).toHaveLength(8);
  });

  it('unlocks construction after completing a country and raises its rent', () => {
    let state = start();
    state = {
      ...state,
      properties: {
        ...state.properties,
        london: { ...(state.properties.london as PropertyState), ownerId: 'a' },
        manchester: { ...(state.properties.manchester as PropertyState), ownerId: 'a' },
        birmingham: { ...(state.properties.birmingham as PropertyState), ownerId: 'a' }
      }
    };
    const rentBefore = calculateRent(
      state,
      worldCapitalRoutesMap,
      state.properties.london as PropertyState
    );
    const cash = state.players.a?.cash ?? 0;

    state = applyGameAction(
      state,
      { type: 'BUILD_UPGRADE', actorId: 'a', propertyId: 'london' },
      worldCapitalRoutesMap,
      context()
    );

    expect(rentBefore).toBe(56);
    expect(state.properties.london?.upgradeLevel).toBe(1);
    expect(state.players.a?.cash).toBe(cash - 140);
    expect(
      calculateRent(state, worldCapitalRoutesMap, state.properties.london as PropertyState)
    ).toBe(84);
  });
});
