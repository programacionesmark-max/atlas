import { invariant } from './errors.js';
import { validateMapConfig } from './map.js';
import type { GamePhase, GameState, MapConfig } from './types.js';

const PHASES: readonly GamePhase[] = [
  'LOBBY',
  'STARTING',
  'TURN_START',
  'ROLLING',
  'MOVING',
  'LANDING',
  'PROPERTY_DECISION',
  'PAYMENT',
  'CARD_EVENT',
  'TRADE',
  'AUCTION',
  'JAIL',
  'TURN_END',
  'GAME_OVER'
];

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeGameState(serialized: string, map?: MapConfig): GameState {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error('Game snapshot is not valid JSON');
  }
  invariant(
    typeof value === 'object' && value !== null,
    'VALIDATION_FAILED',
    'Game snapshot must be an object'
  );
  const record = value as Record<string, unknown>;
  invariant(record.schemaVersion === 1, 'VALIDATION_FAILED', 'Unsupported game snapshot version');
  invariant(
    typeof record.gameId === 'string' && record.gameId.length > 0,
    'VALIDATION_FAILED',
    'Snapshot game id is invalid'
  );
  invariant(typeof record.mapId === 'string', 'VALIDATION_FAILED', 'Snapshot map id is invalid');
  invariant(
    typeof record.phase === 'string' && PHASES.includes(record.phase as GamePhase),
    'VALIDATION_FAILED',
    'Snapshot phase is invalid'
  );
  invariant(
    Number.isSafeInteger(record.revision) && (record.revision as number) >= 0,
    'VALIDATION_FAILED',
    'Snapshot revision is invalid'
  );
  invariant(
    typeof record.players === 'object' && record.players !== null,
    'VALIDATION_FAILED',
    'Snapshot players are invalid'
  );
  invariant(
    Array.isArray(record.turnOrder) && record.turnOrder.length >= 2,
    'VALIDATION_FAILED',
    'Snapshot turn order is invalid'
  );
  invariant(
    typeof record.properties === 'object' && record.properties !== null,
    'VALIDATION_FAILED',
    'Snapshot properties are invalid'
  );
  invariant(
    Array.isArray(record.transactions) && Array.isArray(record.activity),
    'VALIDATION_FAILED',
    'Snapshot ledger is invalid'
  );
  if (map) {
    validateMapConfig(map);
    invariant(
      record.mapId === map.id,
      'VALIDATION_FAILED',
      'Snapshot map does not match supplied map'
    );
    const playerIds = new Set(Object.keys(record.players as object));
    invariant(
      (record.turnOrder as unknown[]).every((id) => typeof id === 'string' && playerIds.has(id)),
      'VALIDATION_FAILED',
      'Turn order references an unknown player'
    );
    const propertyIds = new Set(map.properties.map((property) => property.id));
    invariant(
      Object.keys(record.properties as object).every((id) => propertyIds.has(id)),
      'VALIDATION_FAILED',
      'Snapshot references an unknown property'
    );
  }
  return value as GameState;
}

export function cloneGameState(state: GameState): GameState {
  return deserializeGameState(serializeGameState(state));
}
