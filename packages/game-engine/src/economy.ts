import { invariant } from './errors.js';
import { getPropertyConfig } from './map.js';
import type {
  EngineContext,
  GameState,
  MapConfig,
  PlayerState,
  PropertyState,
  TransactionType
} from './types.js';

export interface LedgerTransfer {
  readonly fromPlayerId: string | null;
  readonly toPlayerId: string | null;
  readonly amount: number;
  readonly type: TransactionType;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

function changeCash(player: PlayerState, delta: number): PlayerState {
  return { ...player, cash: player.cash + delta };
}

export function postTransaction(
  state: GameState,
  transfer: LedgerTransfer,
  context: EngineContext
): GameState {
  invariant(
    Number.isSafeInteger(transfer.amount) && transfer.amount > 0,
    'VALIDATION_FAILED',
    'Transaction amount must be a positive integer'
  );
  const players = { ...state.players };
  if (transfer.fromPlayerId) {
    const from = players[transfer.fromPlayerId];
    invariant(from, 'NOT_FOUND', 'Transaction source player not found');
    invariant(
      from.cash >= transfer.amount,
      'INSUFFICIENT_FUNDS',
      `${from.name} cannot pay ${transfer.amount}`
    );
    players[from.id] = changeCash(from, -transfer.amount);
  }
  if (transfer.toPlayerId) {
    const to = players[transfer.toPlayerId];
    invariant(to, 'NOT_FOUND', 'Transaction destination player not found');
    players[to.id] = changeCash(to, transfer.amount);
  }
  const transaction = {
    id: context.idFactory(),
    gameId: state.gameId,
    fromPlayerId: transfer.fromPlayerId,
    toPlayerId: transfer.toPlayerId,
    type: transfer.type,
    amount: transfer.amount,
    timestamp: context.now,
    ...(transfer.metadata ? { metadata: transfer.metadata } : {})
  } as const;
  return { ...state, players, transactions: [...state.transactions, transaction] };
}

export function ownerHasCompleteGroup(
  state: GameState,
  map: MapConfig,
  ownerId: string,
  group: string
): boolean {
  const groupProperties = map.properties.filter((property) => property.group === group);
  return (
    groupProperties.length > 1 &&
    groupProperties.every((property) => state.properties[property.id]?.ownerId === ownerId)
  );
}

export function calculateRent(state: GameState, map: MapConfig, property: PropertyState): number {
  if (property.mortgaged || !property.ownerId) return 0;
  const config = getPropertyConfig(map, property.propertyId);
  const levelRent = config.rentLevels[property.upgradeLevel] ?? config.baseRent;
  const groupMultiplier =
    property.upgradeLevel === 0 && ownerHasCompleteGroup(state, map, property.ownerId, config.group)
      ? map.economy.completeGroupRentMultiplier
      : 1;
  const owner = state.players[property.ownerId];
  const effectMultiplier =
    owner?.effects
      .filter((effect) => effect.type === 'RENT_BOOST')
      .reduce((value, effect) => value * (effect.multiplier ?? 1), 1) ?? 1;
  return Math.max(
    0,
    Math.round(levelRent * groupMultiplier * effectMultiplier * state.rules.rentMultiplier)
  );
}

export function calculateNetWorth(state: GameState, map: MapConfig, playerId: string): number {
  const player = state.players[playerId];
  invariant(player, 'NOT_FOUND', 'Player not found');
  return Object.values(state.properties).reduce((total, property) => {
    if (property.ownerId !== playerId) return total;
    const config = getPropertyConfig(map, property.propertyId);
    const propertyValue = property.mortgaged ? config.mortgageValue : config.purchasePrice;
    return total + propertyValue + property.upgradeLevel * Math.floor(config.upgradeCost / 2);
  }, player.cash);
}

export function unmortgageCost(map: MapConfig, propertyId: string): number {
  const value = getPropertyConfig(map, propertyId).mortgageValue;
  return Math.ceil(value * (1 + map.economy.unmortgageInterestRate));
}
