import { describe, expect, it } from 'vitest';
import { applyGameAction, createGame } from './engine.js';
import { neonCityMap } from './maps/neon-city.js';
import { SequenceRandomSource } from './random.js';
import type { EngineContext, GameAction, GameState, PlayerState, PropertyState } from './types.js';

let serial = 0;
const ctx = (): EngineContext => ({
  now: 10_000 + serial,
  random: new SequenceRandomSource([1, 2]),
  idFactory: () => `trade-${++serial}`
});
const apply = (state: GameState, action: GameAction) =>
  applyGameAction(state, action, neonCityMap, ctx());
function started(): GameState {
  let state = createGame({
    gameId: 'trade-game',
    map: neonCityMap,
    players: [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bo' }
    ],
    now: 1
  });
  state = apply(state, { type: 'START_GAME', actorId: 'a' });
  return state;
}

describe('validated trades', () => {
  it('atomically exchanges cash and properties and keeps both money operations in the ledger', () => {
    let state = started();
    state = {
      ...state,
      players: {
        ...state.players,
        a: { ...(state.players.a as PlayerState), resources: ['rent-shield'] },
        b: { ...(state.players.b as PlayerState), resources: ['double-dice'] }
      },
      properties: {
        ...state.properties,
        'pulse-alley': { ...(state.properties['pulse-alley'] as PropertyState), ownerId: 'a' }
      }
    };
    state = apply(state, {
      type: 'OFFER_TRADE',
      actorId: 'a',
      recipientId: 'b',
      offered: { cash: 100, propertyIds: ['pulse-alley'], resources: ['rent-shield'] },
      requested: { cash: 250, propertyIds: [], resources: ['double-dice'] }
    });
    const tradeId = state.activeTradeId as string;
    expect(state.phase).toBe('TRADE');
    state = apply(state, { type: 'ACCEPT_TRADE', actorId: 'b', tradeId });
    expect(state.properties['pulse-alley']?.ownerId).toBe('b');
    expect(state.players.a?.cash).toBe(state.rules.startingCash + 150);
    expect(state.players.b?.cash).toBe(state.rules.startingCash - 150);
    expect(state.players.a?.resources).toEqual(['double-dice']);
    expect(state.players.b?.resources).toEqual(['rent-shield']);
    expect(state.transactions.slice(-2).map((entry) => entry.type)).toEqual(['TRADE', 'TRADE']);
    expect(state.trades[tradeId]?.status).toBe('ACCEPTED');
  });

  it('supports declining without mutating assets', () => {
    let state = started();
    state = apply(state, {
      type: 'OFFER_TRADE',
      actorId: 'a',
      recipientId: 'b',
      offered: { cash: 100, propertyIds: [], resources: [] },
      requested: { cash: 0, propertyIds: [], resources: [] }
    });
    const tradeId = state.activeTradeId as string;
    state = apply(state, { type: 'DECLINE_TRADE', actorId: 'b', tradeId });
    expect(state.phase).toBe('TURN_START');
    expect(state.players.a?.cash).toBe(state.rules.startingCash);
    expect(state.trades[tradeId]?.status).toBe('DECLINED');
  });
});

describe('bankruptcy and victory', () => {
  it('transfers assets to a player creditor and ends a two-player game', () => {
    let state = started();
    state = {
      ...state,
      phase: 'PAYMENT',
      currentPlayerIndex: 1,
      players: { ...state.players, b: { ...(state.players.b as PlayerState), cash: 75 } },
      properties: {
        ...state.properties,
        'pulse-alley': { ...(state.properties['pulse-alley'] as PropertyState), ownerId: 'b' }
      },
      paymentDue: {
        debtorId: 'b',
        creditorId: 'a',
        amount: 5_000,
        reason: 'RENT',
        transactionType: 'RENT'
      }
    };
    state = apply(state, { type: 'DECLARE_BANKRUPTCY', actorId: 'b' });
    expect(state.players.b?.status).toBe('BANKRUPT');
    expect(state.players.a?.cash).toBe(state.rules.startingCash + 75);
    expect(state.properties['pulse-alley']?.ownerId).toBe('a');
    expect(state.phase).toBe('GAME_OVER');
    expect(state.winnerIds).toEqual(['a']);
  });

  it('returns assets to the bank cleanly for a bank debt', () => {
    let state = started();
    state = {
      ...state,
      phase: 'PAYMENT',
      currentPlayerIndex: 1,
      properties: {
        ...state.properties,
        'pulse-alley': {
          ...(state.properties['pulse-alley'] as PropertyState),
          ownerId: 'b',
          mortgaged: true,
          upgradeLevel: 0
        }
      },
      paymentDue: {
        debtorId: 'b',
        creditorId: null,
        amount: 5_000,
        reason: 'TAX',
        transactionType: 'TAX'
      }
    };
    state = apply(state, { type: 'DECLARE_BANKRUPTCY', actorId: 'b' });
    expect(state.properties['pulse-alley']).toMatchObject({
      ownerId: null,
      mortgaged: false,
      upgradeLevel: 0
    });
  });
});
