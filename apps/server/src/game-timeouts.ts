import type { GameState } from '@circuit/game-engine';
import type { JsonValue } from '@circuit/shared';

export interface TimedGameAction {
  actorId: string;
  type: string;
  payload?: JsonValue;
  dueAt: number;
}

export function nextTimedGameAction(state: GameState): TimedGameAction | null {
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  if (!currentPlayerId || state.phase === 'GAME_OVER') return null;

  if (state.phase === 'AUCTION' && state.auction) {
    return {
      actorId: currentPlayerId,
      type: 'CLOSE_AUCTION',
      payload: {},
      dueAt: state.auction.endsAt
    };
  }

  if (state.turnStartedAt === null || state.rules.turnTimeMs === null) return null;
  const dueAt = state.turnStartedAt + state.rules.turnTimeMs;

  switch (state.phase) {
    case 'TURN_START':
    case 'JAIL':
      return { actorId: currentPlayerId, type: 'ROLL_DICE', payload: {}, dueAt };
    case 'PROPERTY_DECISION':
      return { actorId: currentPlayerId, type: 'DECLINE_PROPERTY', payload: {}, dueAt };
    case 'FLIGHT_DECISION':
      return { actorId: currentPlayerId, type: 'DECLINE_FLIGHT', payload: {}, dueAt };
    case 'ROUND_EVENT':
      return {
        actorId: state.pendingRoundEvent?.playerId ?? currentPlayerId,
        type: 'REVEAL_ROUND_EVENT',
        payload: { cardIndex: 0 },
        dueAt
      };
    case 'TURN_END':
      return { actorId: currentPlayerId, type: 'END_TURN', payload: {}, dueAt };
    case 'PAYMENT':
      return {
        actorId: state.paymentDue?.debtorId ?? currentPlayerId,
        type: 'DECLARE_BANKRUPTCY',
        payload: {},
        dueAt
      };
    case 'TRADE': {
      const trade = state.activeTradeId ? state.trades[state.activeTradeId] : undefined;
      return trade
        ? {
            actorId: trade.proposerId,
            type: 'CANCEL_TRADE',
            payload: { tradeId: trade.id },
            dueAt
          }
        : null;
    }
    default:
      return null;
  }
}
