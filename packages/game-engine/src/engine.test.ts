import { describe, expect, it } from 'vitest';
import { calculateNetWorth, calculateRent } from './economy.js';
import { applyGameAction, createGame } from './engine.js';
import { GameRuleError } from './errors.js';
import { neonCityMap } from './maps/neon-city.js';
import { SequenceRandomSource } from './random.js';
import type { EngineContext, GameAction, GameState, PlayerState, PropertyState } from './types.js';

let id = 0;
let now = 1_000;
const context = (rolls: readonly number[] = [1, 2]): EngineContext => ({
  now: now++,
  random: new SequenceRandomSource(rolls),
  idFactory: () => `id-${++id}`
});
const fresh = (rules: Parameters<typeof createGame>[0]['rules'] = {}): GameState =>
  createGame({
    gameId: `game-${++id}`,
    map: neonCityMap,
    players: [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bo' }
    ],
    rules,
    now: now++
  });
const act = (state: GameState, action: GameAction, rolls?: readonly number[]) =>
  applyGameAction(state, action, neonCityMap, context(rolls));
const start = (state = fresh()) => act(state, { type: 'START_GAME', actorId: 'a' });

describe('authoritative turn, movement, and economy', () => {
  it('uses injected server randomness and never accepts a client-provided result', () => {
    let state = start();
    state = act(state, { type: 'ROLL_DICE', actorId: 'a' }, [1, 2]);
    expect(state.lastRoll).toEqual({ dice: [1, 2], total: 3, doubles: false });
    expect(state.players.a?.positionTileId).toBe('synth-court');
    expect(state.phase).toBe('PROPERTY_DECISION');
    expect(state.players.a?.stats.totalRolled).toBe(3);
  });

  it('enforces actor turn ownership and optimistic revision', () => {
    const state = start();
    expect(() => act(state, { type: 'ROLL_DICE', actorId: 'b' }, [1, 2])).toThrowError(
      GameRuleError
    );
    expect(() =>
      act(state, { type: 'ROLL_DICE', actorId: 'a', expectedRevision: 0 }, [1, 2])
    ).toThrowError(/Expected revision/);
  });

  it('buys a property, records it, then automatically pays its rent', () => {
    let state = start();
    state = act(state, { type: 'ROLL_DICE', actorId: 'a' }, [1, 2]);
    const cashBefore = state.players.a?.cash ?? 0;
    state = act(state, { type: 'BUY_PROPERTY', actorId: 'a' });
    expect(state.properties['synth-court']?.ownerId).toBe('a');
    expect(state.players.a?.cash).toBe(cashBefore - 360);
    expect(state.transactions.at(-1)?.type).toBe('PROPERTY_PURCHASE');
    state = act(state, { type: 'END_TURN', actorId: 'a' });
    const aCash = state.players.a?.cash ?? 0;
    const bCash = state.players.b?.cash ?? 0;
    state = act(state, { type: 'ROLL_DICE', actorId: 'b' }, [1, 2]);
    expect(state.phase).toBe('TURN_END');
    expect(state.players.a?.cash).toBe(aCash + 45);
    expect(state.players.b?.cash).toBe(bCash - 45);
    expect(state.transactions.at(-1)?.type).toBe('RENT');
    expect(state.players.a?.stats.rentEarned).toBe(45);
    expect(state.players.b?.stats.rentPaid).toBe(45);
  });

  it('resolves tax tiles through the ledger', () => {
    let state = start();
    const cash = state.players.a?.cash ?? 0;
    state = act(state, { type: 'ROLL_DICE', actorId: 'a' }, [2, 3]);
    expect(state.players.a?.positionTileId).toBe('data-tax');
    expect(state.players.a?.cash).toBe(cash - 220);
    expect(state.transactions.at(-1)?.type).toBe('TAX');
  });

  it('detains a player and consumes a failed escape turn', () => {
    let state = start();
    state = {
      ...state,
      players: {
        ...state.players,
        a: {
          ...(state.players.a as PlayerState),
          positionTileId: neonCityMap.jailTileId,
          jailedTurns: 2
        }
      }
    };
    state = act(state, { type: 'ROLL_DICE', actorId: 'a' }, [1, 2]);
    expect(state.players.a?.jailedTurns).toBe(1);
    expect(state.players.a?.positionTileId).toBe(neonCityMap.jailTileId);
    expect(state.phase).toBe('TURN_END');
  });
});

describe('auctions and assets', () => {
  it('awards an auction only after authoritative pass/close rules', () => {
    let state = start();
    state = act(state, { type: 'ROLL_DICE', actorId: 'a' }, [1, 2]);
    state = act(state, { type: 'DECLINE_PROPERTY', actorId: 'a' });
    state = act(state, { type: 'BID_AUCTION', actorId: 'b', amount: 200 });
    state = act(state, { type: 'PASS_AUCTION', actorId: 'a' });
    expect(state.phase).toBe('TURN_END');
    expect(state.auction).toBeNull();
    expect(state.properties['synth-court']?.ownerId).toBe('b');
    expect(state.players.b?.cash).toBe(state.rules.startingCash - 200);
    expect(state.transactions.at(-1)?.type).toBe('AUCTION_PURCHASE');
  });

  it('mortgages to raise debt cash and settles the exact liability', () => {
    let state = start();
    state = {
      ...state,
      phase: 'PAYMENT',
      players: { ...state.players, a: { ...(state.players.a as PlayerState), cash: 20 } },
      properties: {
        ...state.properties,
        'synth-court': { ...(state.properties['synth-court'] as PropertyState), ownerId: 'a' }
      },
      paymentDue: {
        debtorId: 'a',
        creditorId: 'b',
        amount: 150,
        reason: 'RENT',
        transactionType: 'RENT'
      }
    };
    state = act(state, { type: 'MORTGAGE_PROPERTY', actorId: 'a', propertyId: 'synth-court' });
    expect(state.players.a?.cash).toBe(200);
    expect(state.properties['synth-court']?.mortgaged).toBe(true);
    state = act(state, { type: 'SETTLE_DEBT', actorId: 'a' });
    expect(state.players.a?.cash).toBe(50);
    expect(state.players.b?.cash).toBe(state.rules.startingCash + 150);
    expect(state.paymentDue).toBeNull();
  });

  it('doubles base rent for a complete undeveloped group and counts net worth', () => {
    let state = fresh();
    state = {
      ...state,
      properties: {
        ...state.properties,
        'pulse-alley': { ...(state.properties['pulse-alley'] as PropertyState), ownerId: 'a' },
        'synth-court': { ...(state.properties['synth-court'] as PropertyState), ownerId: 'a' }
      }
    };
    expect(
      calculateRent(state, neonCityMap, state.properties['pulse-alley'] as PropertyState)
    ).toBe(70);
    expect(calculateNetWorth(state, neonCityMap, 'a')).toBe(state.rules.startingCash + 660);
  });
});
