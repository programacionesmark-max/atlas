import { createGame, neonCityMap, type GameState } from '@circuit/game-engine';
import { describe, expect, it } from 'vitest';

import type { ManagedRoom } from '../src/domain.js';
import { buildMatchRecap } from '../src/match-recap.js';
import { SerializedQueue } from '../src/serialized-queue.js';

describe('match recap', () => {
  it('derives standings, real statistics, awards and highlights from authoritative state', () => {
    const created = createGame({
      gameId: '8e527c25-e796-4541-97bd-becf57cddc90',
      map: neonCityMap,
      players: [
        { id: '2a43358b-0e9e-437c-a8e9-aa1ba1ee2913', name: 'Jamie' },
        { id: '03c390a8-b35f-4b47-acf7-dc79ab4a0dab', name: 'Alex' }
      ],
      now: 1_000
    });
    const winnerId = created.turnOrder[0]!;
    const loserId = created.turnOrder[1]!;
    const state: GameState = {
      ...created,
      phase: 'GAME_OVER',
      round: 7,
      updatedAt: 61_000,
      winnerIds: [winnerId],
      players: {
        ...created.players,
        [winnerId]: {
          ...created.players[winnerId]!,
          cash: 4_200,
          stats: {
            rentPaid: 120,
            rentEarned: 900,
            propertiesPurchased: 3,
            tradesCompleted: 2,
            totalRolled: 14
          }
        },
        [loserId]: { ...created.players[loserId]!, cash: 0, status: 'BANKRUPT' }
      },
      activity: [
        {
          id: 'start',
          timestamp: 1_000,
          type: 'GAME_STARTED',
          message: 'The game started'
        },
        {
          id: 'roll-1',
          timestamp: 2_000,
          type: 'DICE_ROLL',
          message: 'Jamie rolled 7',
          playerId: winnerId
        },
        {
          id: 'roll-2',
          timestamp: 3_000,
          type: 'DICE_ROLL',
          message: 'Jamie rolled 7',
          playerId: winnerId
        },
        {
          id: 'bankrupt',
          timestamp: 60_000,
          type: 'BANKRUPTCY',
          message: 'Alex is bankrupt',
          playerId: loserId
        }
      ]
    };
    const room = {
      id: 'd4826206-1739-4728-abba-91ae1f3ee55a',
      code: 'ABC234',
      settings: {
        name: 'World tour',
        visibility: 'PUBLIC',
        maxPlayers: 4,
        mapId: neonCityMap.id,
        mode: 'CLASSIC',
        allowSpectators: true,
        rules: {
          startingCash: 3_200,
          turnTimerSeconds: 45,
          victoryMode: 'LAST_PLAYER_STANDING',
          maxRounds: 30,
          netWorthTarget: null,
          auctionsEnabled: true,
          tradesEnabled: true,
          economicEventsEnabled: true,
          doublesExtraRoll: true
        }
      },
      passwordHash: null,
      status: 'FINISHED',
      version: 3,
      hostPlayerId: winnerId,
      members: new Map(),
      game: {
        id: state.gameId,
        state,
        map: neonCityMap,
        eventSequence: 8,
        persistedTransactionCount: state.transactions.length,
        handledActionIds: new Set<string>()
      },
      createdAt: new Date(1_000),
      queue: new SerializedQueue()
    } satisfies ManagedRoom;

    const recap = buildMatchRecap(room);
    expect(recap.players[0]).toMatchObject({
      playerId: winnerId,
      placement: 1,
      rentEarned: 900,
      averageRoll: 7
    });
    expect(recap.players[1]).toMatchObject({
      playerId: loserId,
      placement: 2,
      status: 'BANKRUPT'
    });
    expect(recap.awards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'WINNER', playerId: winnerId }),
        expect.objectContaining({ id: 'RENT_COLLECTOR', playerId: winnerId })
      ])
    );
    expect(recap.highlights.map((item) => item.type)).toEqual(['GAME_STARTED', 'BANKRUPTCY']);
    expect(recap.durationMs).toBe(60_000);
  });
});
