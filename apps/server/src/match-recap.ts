import { calculateNetWorth, type GameState, type MapConfig } from '@circuit/game-engine';
import type {
  MatchHighlight,
  MatchRecap,
  MatchRecapAward,
  MatchRecapPlayer
} from '@circuit/shared';

import type { ManagedRoom } from './domain.js';

const HIGHLIGHT_TYPES = new Set([
  'GAME_STARTED',
  'PROPERTY_BOUGHT',
  'AUCTION_WON',
  'BANKRUPTCY',
  'CHAOS_MARKET',
  'SURVIVAL_LEVY'
]);

function transactionTotals(state: GameState, playerId: string) {
  const outgoing = state.transactions.filter((item) => item.fromPlayerId === playerId);
  const incoming = state.transactions.filter((item) => item.toPlayerId === playerId);
  return {
    moneyEarned: incoming.reduce((total, item) => total + item.amount, 0),
    moneySpent: outgoing.reduce((total, item) => total + item.amount, 0),
    biggestPaymentReceived: incoming.reduce((highest, item) => Math.max(highest, item.amount), 0),
    biggestPaymentMade: outgoing.reduce((highest, item) => Math.max(highest, item.amount), 0),
    auctionsWon: outgoing.filter((item) => item.type === 'AUCTION_PURCHASE').length,
    auctionSpend: outgoing
      .filter((item) => item.type === 'AUCTION_PURCHASE')
      .reduce((total, item) => total + item.amount, 0),
    mortgagesCreated: incoming.filter((item) => item.type === 'MORTGAGE').length,
    mortgagesRecovered: outgoing.filter((item) => item.type === 'UNMORTGAGE').length,
    upgradesPurchased: outgoing.filter((item) => item.type === 'UPGRADE_PURCHASE').length
  };
}

function placementOrder(state: GameState, map: MapConfig): string[] {
  const winners = new Set(state.winnerIds);
  return [...state.turnOrder].sort((leftId, rightId) => {
    const leftWinner = winners.has(leftId);
    const rightWinner = winners.has(rightId);
    if (leftWinner !== rightWinner) return leftWinner ? -1 : 1;
    const left = state.players[leftId];
    const right = state.players[rightId];
    if (left?.status === 'BANKRUPT' && right?.status !== 'BANKRUPT') return 1;
    if (right?.status === 'BANKRUPT' && left?.status !== 'BANKRUPT') return -1;
    return calculateNetWorth(state, map, rightId) - calculateNetWorth(state, map, leftId);
  });
}

function bestPlayer(
  players: readonly MatchRecapPlayer[],
  value: (player: MatchRecapPlayer) => number
): MatchRecapPlayer | null {
  let best: MatchRecapPlayer | null = null;
  for (const player of players) {
    if (!best || value(player) > value(best)) best = player;
  }
  return best;
}

function createAwards(
  players: readonly MatchRecapPlayer[],
  winnerPlayerIds: readonly string[]
): MatchRecapAward[] {
  const awards: MatchRecapAward[] = winnerPlayerIds.map((playerId) => ({
    id: 'WINNER',
    playerId,
    label: 'Winner',
    value: 1
  }));
  const definitions = [
    ['RICHEST_PLAYER', 'Richest player', (player: MatchRecapPlayer) => player.netWorth],
    ['PROPERTY_KING', 'Property king', (player: MatchRecapPlayer) => player.propertiesOwned],
    ['MASTER_TRADER', 'Master trader', (player: MatchRecapPlayer) => player.tradesCompleted],
    ['LUCKIEST_PLAYER', 'Luckiest player', (player: MatchRecapPlayer) => player.averageRoll],
    ['BIGGEST_SPENDER', 'Biggest spender', (player: MatchRecapPlayer) => player.moneySpent],
    ['RENT_COLLECTOR', 'Rent collector', (player: MatchRecapPlayer) => player.rentEarned]
  ] as const;
  for (const [id, label, value] of definitions) {
    const best = bestPlayer(players, value);
    if (best && value(best) > 0)
      awards.push({ id, playerId: best.playerId, label, value: value(best) });
  }
  return awards;
}

function createHighlights(state: GameState): MatchHighlight[] {
  const candidates = state.activity.filter((entry) => HIGHLIGHT_TYPES.has(entry.type));
  return candidates.slice(-12).map((entry, index) => ({
    id: entry.id,
    round: Math.max(
      1,
      Math.min(state.round, Math.floor(index / Math.max(1, state.turnOrder.length)) + 1)
    ),
    timestamp: new Date(entry.timestamp).toISOString(),
    type: entry.type,
    message: entry.message,
    playerId: entry.playerId ?? null
  }));
}

export function buildMatchRecap(room: ManagedRoom): MatchRecap {
  const game = room.game;
  if (!game || game.state.phase !== 'GAME_OVER') throw new Error('Game is not finished');
  const state = game.state;
  const order = placementOrder(state, game.map);
  const players = order.map((playerId, index): MatchRecapPlayer => {
    const player = state.players[playerId];
    if (!player) throw new Error(`Missing player ${playerId}`);
    const rolls = state.activity.filter(
      (entry) => entry.type === 'DICE_ROLL' && entry.playerId === playerId
    ).length;
    const netWorth = calculateNetWorth(state, game.map, playerId);
    return {
      playerId,
      nickname: player.name,
      placement: index + 1,
      status: player.status,
      finalCash: player.cash,
      netWorth,
      propertyValue: netWorth - player.cash,
      propertiesOwned: Object.values(state.properties).filter(
        (property) => property.ownerId === playerId
      ).length,
      propertiesPurchased: player.stats.propertiesPurchased,
      rentEarned: player.stats.rentEarned,
      rentPaid: player.stats.rentPaid,
      tradesCompleted: player.stats.tradesCompleted,
      totalRolled: player.stats.totalRolled,
      rolls,
      averageRoll: rolls > 0 ? Math.round((player.stats.totalRolled / rolls) * 10) / 10 : 0,
      bankruptcyCause: player.status === 'BANKRUPT' ? 'Unable to settle an outstanding debt' : null,
      ...transactionTotals(state, playerId)
    };
  });
  const finishedAt = state.updatedAt;
  return {
    matchId: game.id,
    gameId: game.id,
    roomId: room.id,
    roomName: room.settings.name,
    mapId: state.mapId,
    mode: room.settings.mode,
    visibility: room.settings.visibility,
    winnerPlayerIds: [...state.winnerIds],
    victoryReason: state.rules.victoryMode,
    durationMs: Math.max(0, finishedAt - state.createdAt),
    roundsPlayed: state.round,
    startedAt: new Date(state.createdAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    players,
    awards: createAwards(players, state.winnerIds),
    highlights: createHighlights(state)
  };
}
