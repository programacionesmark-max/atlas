export type EngineErrorCode =
  | 'INVALID_ACTION'
  | 'INVALID_PHASE'
  | 'NOT_YOUR_TURN'
  | 'STALE_REVISION'
  | 'INSUFFICIENT_FUNDS'
  | 'NOT_FOUND'
  | 'NOT_OWNER'
  | 'VALIDATION_FAILED';

export class GameRuleError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export function invariant(
  condition: unknown,
  code: EngineErrorCode,
  message: string
): asserts condition {
  if (!condition) throw new GameRuleError(code, message);
}
