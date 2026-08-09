import {
  applyGameAction,
  createGame,
  neonCityMap,
  SequenceRandomSource
} from '@circuit/game-engine';
import { describe, expect, it } from 'vitest';

import { nextTimedGameAction } from '../src/game-timeouts.js';

const context = (now: number) => ({
  now,
  random: new SequenceRandomSource([1, 2]),
  idFactory: () => '00000000-0000-4000-8000-000000000001'
});

function startedGame() {
  let state = createGame({
    gameId: 'timer-game',
    map: neonCityMap,
    players: [
      { id: 'host', name: 'Maya' },
      { id: 'guest', name: 'Theo' }
    ],
    rules: { turnTimeMs: 15_000 },
    now: 1_000
  });
  state = applyGameAction(
    state,
    { type: 'START_GAME', actorId: 'host', expectedRevision: state.revision },
    neonCityMap,
    context(1_000)
  );
  return state;
}

describe('authoritative game timeouts', () => {
  it('rolls automatically when a player does not begin their turn', () => {
    expect(nextTimedGameAction(startedGame())).toMatchObject({
      actorId: 'host',
      type: 'ROLL_DICE',
      dueAt: 16_000
    });
  });

  it('closes an auction at its server deadline', () => {
    const state = {
      ...startedGame(),
      phase: 'AUCTION' as const,
      auction: {
        propertyId: 'pulse-alley',
        startedByPlayerId: 'host',
        currentBid: 0,
        highestBidderId: null,
        passedPlayerIds: [],
        endsAt: 9_500
      }
    };
    expect(nextTimedGameAction(state)).toMatchObject({ type: 'CLOSE_AUCTION', dueAt: 9_500 });
  });

  it('cancels an unanswered trade so the turn can continue', () => {
    const base = startedGame();
    const state = {
      ...base,
      phase: 'TRADE' as const,
      activeTradeId: '00000000-0000-4000-8000-000000000010',
      trades: {
        '00000000-0000-4000-8000-000000000010': {
          id: '00000000-0000-4000-8000-000000000010',
          proposerId: 'host',
          recipientId: 'guest',
          offered: { cash: 50, propertyIds: [], resources: [] },
          requested: { cash: 0, propertyIds: [], resources: [] },
          status: 'OPEN' as const,
          createdAt: 1_100
        }
      }
    };
    expect(nextTimedGameAction(state)).toMatchObject({
      actorId: 'host',
      type: 'CANCEL_TRADE',
      payload: { tradeId: state.activeTradeId }
    });
  });
});
