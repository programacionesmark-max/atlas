import { describe, expect, it } from 'vitest';
import { GameRuleError } from './errors.js';
import { assertPhaseTransition, canTransition } from './state-machine.js';

describe('phase state machine', () => {
  it('allows authoritative atomic roll resolution and interactive decisions', () => {
    expect(canTransition('TURN_START', 'PROPERTY_DECISION')).toBe(true);
    expect(canTransition('PROPERTY_DECISION', 'AUCTION')).toBe(true);
    expect(canTransition('AUCTION', 'TURN_END')).toBe(true);
  });

  it('rejects impossible backwards transitions and all actions after game over', () => {
    expect(canTransition('GAME_OVER', 'TURN_START')).toBe(false);
    expect(() => assertPhaseTransition('AUCTION', 'LOBBY')).toThrow(GameRuleError);
  });
});
