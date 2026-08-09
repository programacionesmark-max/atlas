import { invariant } from './errors.js';
import type { GamePhase } from './types.js';

/**
 * Authoritative, externally-observable phase transitions. Transient phases such as
 * ROLLING, MOVING and LANDING may be resolved atomically by one server command.
 */
export const ALLOWED_PHASE_TRANSITIONS: Readonly<Record<GamePhase, readonly GamePhase[]>> = {
  LOBBY: ['STARTING', 'TURN_START'],
  STARTING: ['TURN_START'],
  TURN_START: [
    'ROLLING',
    'MOVING',
    'LANDING',
    'PROPERTY_DECISION',
    'PAYMENT',
    'CARD_EVENT',
    'JAIL',
    'TURN_END',
    'TRADE'
  ],
  ROLLING: ['MOVING', 'JAIL', 'TURN_END'],
  MOVING: ['LANDING'],
  LANDING: ['PROPERTY_DECISION', 'PAYMENT', 'CARD_EVENT', 'JAIL', 'TURN_END'],
  PROPERTY_DECISION: ['PROPERTY_DECISION', 'AUCTION', 'TURN_END'],
  PAYMENT: ['PAYMENT', 'TURN_END', 'TURN_START', 'GAME_OVER'],
  CARD_EVENT: ['PAYMENT', 'TURN_END'],
  TRADE: ['TRADE', 'TURN_START', 'TURN_END'],
  AUCTION: ['AUCTION', 'TURN_END'],
  JAIL: ['ROLLING', 'MOVING', 'TURN_END'],
  TURN_END: ['TURN_END', 'TURN_START', 'TRADE', 'GAME_OVER'],
  GAME_OVER: []
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return from === to || ALLOWED_PHASE_TRANSITIONS[from].includes(to);
}

export function assertPhaseTransition(from: GamePhase, to: GamePhase): void {
  invariant(canTransition(from, to), 'INVALID_PHASE', `Illegal phase transition: ${from} -> ${to}`);
}
