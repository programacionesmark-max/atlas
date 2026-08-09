import { describe, expect, it } from 'vitest';

import { applyGameAction, createGame } from './engine.js';
import { worldCapitalRoutesMap } from './maps/world-capital-routes.js';
import type { EngineContext, GameState, RandomSource } from './types.js';

class SequenceRandom implements RandomSource {
  constructor(private readonly values: number[]) {}

  nextInt(minInclusive: number, maxInclusive: number): number {
    const value = this.values.shift() ?? minInclusive;
    return Math.min(maxInclusive, Math.max(minInclusive, value));
  }
}

function context(values: number[], now: number): EngineContext {
  let serial = 0;
  return {
    now,
    random: new SequenceRandom(values),
    idFactory: () => `round-event-${now}-${++serial}`
  };
}

function gameAtEndOfRoundThree(eventDeckEnabled = true): GameState {
  const created = createGame({
    gameId: 'round-event-game',
    map: worldCapitalRoutesMap,
    players: [
      { id: 'a', name: 'Atlas' },
      { id: 'b', name: 'Nova' }
    ],
    now: 1,
    rules: { eventDeckEnabled }
  });
  const started = applyGameAction(
    created,
    { type: 'START_GAME', actorId: 'a' },
    worldCapitalRoutesMap,
    context([], 2)
  );
  return {
    ...started,
    phase: 'TURN_END',
    round: 3,
    currentPlayerIndex: 1,
    turnStartedAt: 3,
    updatedAt: 3
  };
}

describe('Atlas round events', () => {
  it('opens a surprise for a random active player every four rounds', () => {
    const state = applyGameAction(
      gameAtEndOfRoundThree(),
      { type: 'END_TURN', actorId: 'b' },
      worldCapitalRoutesMap,
      context([1], 4)
    );

    expect(state).toMatchObject({
      round: 4,
      phase: 'ROUND_EVENT',
      pendingRoundEvent: { playerId: 'b', round: 4 }
    });
  });

  it('reveals the authoritative reward and resumes the next turn', () => {
    const waiting = applyGameAction(
      gameAtEndOfRoundThree(),
      { type: 'END_TURN', actorId: 'b' },
      worldCapitalRoutesMap,
      context([0], 4)
    );
    const resolved = applyGameAction(
      waiting,
      { type: 'REVEAL_ROUND_EVENT', actorId: 'a', cardIndex: 2 },
      worldCapitalRoutesMap,
      context([0], 5)
    );

    expect(resolved.players.a?.cash).toBe(waiting.players.a!.cash + 450);
    expect(resolved).toMatchObject({
      phase: 'TURN_START',
      pendingRoundEvent: null,
      lastRoundEvent: { playerId: 'a', outcome: 'CASH_PRIZE', amount: 450 }
    });
    expect(resolved.activity.at(-1)?.type).toBe('ROUND_EVENT_CASH_PRIZE');
  });

  it('does not interrupt games that have economic events disabled', () => {
    const state = applyGameAction(
      gameAtEndOfRoundThree(false),
      { type: 'END_TURN', actorId: 'b' },
      worldCapitalRoutesMap,
      context([0], 4)
    );

    expect(state).toMatchObject({ round: 4, phase: 'TURN_START', pendingRoundEvent: null });
  });
});
