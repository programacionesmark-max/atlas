import { EVENT_DEFINITIONS_BY_ID, NEON_EVENT_DECK, type EventDefinition } from './events/events.js';
import { GameRuleError, invariant } from './errors.js';
import {
  calculateNetWorth,
  calculateRent,
  ownerHasCompleteGroup,
  postTransaction,
  unmortgageCost
} from './economy.js';
import { getPropertyConfig, getTile, validateMapConfig } from './map.js';
import { assertPhaseTransition } from './state-machine.js';
import type {
  ActiveEffect,
  AuctionState,
  CreateGameInput,
  DiceRoll,
  EngineContext,
  GameAction,
  GamePhase,
  GameRules,
  GameState,
  MapConfig,
  PaymentDue,
  PlayerState,
  PropertyState,
  TradeAssetBundle,
  TradeOffer,
  TransactionType
} from './types.js';

export function defaultRules(map: MapConfig): GameRules {
  return {
    startingCash: map.economy.startingCash,
    auctionsEnabled: true,
    auctionDurationMs: 20_000,
    minimumBid: 10,
    turnTimeMs: 45_000,
    salaryOnPassStart: map.economy.passStartAward,
    maxRounds: null,
    victoryMode: 'LAST_PLAYER_STANDING',
    netWorthTarget: null,
    eventDeckEnabled: true,
    jailTurns: 2,
    maxUpgradeLevel: 4,
    propertyPriceMultiplier: 1,
    rentMultiplier: 1,
    roundCashSwing: 0,
    roundLevy: 0
  };
}

function blankStats() {
  return {
    rentPaid: 0,
    rentEarned: 0,
    propertiesPurchased: 0,
    tradesCompleted: 0,
    totalRolled: 0
  } as const;
}

export function createGame(input: CreateGameInput): GameState {
  validateMapConfig(input.map);
  invariant(
    input.players.length >= 2 && input.players.length <= 8,
    'VALIDATION_FAILED',
    'A game requires 2 to 8 players'
  );
  invariant(
    new Set(input.players.map((player) => player.id)).size === input.players.length,
    'VALIDATION_FAILED',
    'Player ids must be unique'
  );
  const rules = { ...defaultRules(input.map), ...input.rules };
  invariant(
    Number.isSafeInteger(rules.startingCash) && rules.startingCash >= 0,
    'VALIDATION_FAILED',
    'Starting cash is invalid'
  );
  const players = Object.fromEntries(
    input.players.map((seed) => [
      seed.id,
      {
        id: seed.id,
        name: seed.name,
        teamId: seed.teamId ?? null,
        cash: rules.startingCash,
        positionTileId: input.map.startTileId,
        status: 'ACTIVE',
        jailedTurns: 0,
        effects: [],
        resources: [],
        stats: blankStats()
      } satisfies PlayerState
    ])
  );
  const properties = Object.fromEntries(
    input.map.properties.map((property) => [
      property.id,
      {
        propertyId: property.id,
        ownerId: null,
        upgradeLevel: 0,
        mortgaged: false
      } satisfies PropertyState
    ])
  );
  return {
    schemaVersion: 1,
    gameId: input.gameId,
    mapId: input.map.id,
    phase: 'LOBBY',
    revision: 0,
    createdAt: input.now,
    updatedAt: input.now,
    rules,
    players,
    turnOrder: input.players.map((player) => player.id),
    currentPlayerIndex: 0,
    round: 1,
    turnStartedAt: null,
    lastRoll: null,
    properties,
    transactions: input.players.map((player, index) => ({
      id: `initial-${input.gameId}-${index}-${player.id}`,
      gameId: input.gameId,
      fromPlayerId: null,
      toPlayerId: player.id,
      type: 'STARTING_CASH',
      amount: rules.startingCash,
      timestamp: input.now
    })),
    activity: [],
    pendingPropertyDecision: null,
    pendingFlightDecision: null,
    lastMovement: null,
    paymentDue: null,
    auction: null,
    trades: {},
    activeTradeId: null,
    resumePhase: null,
    eventDeck: input.eventDeck ? [...input.eventDeck] : [...NEON_EVENT_DECK],
    eventDiscard: [],
    winnerIds: []
  };
}

function currentPlayerId(state: GameState): string {
  const playerId = state.turnOrder[state.currentPlayerIndex];
  invariant(playerId, 'INVALID_ACTION', 'No current player');
  return playerId;
}

function assertCurrentPlayer(state: GameState, actorId: string): void {
  invariant(
    currentPlayerId(state) === actorId,
    'NOT_YOUR_TURN',
    'Only the current player can perform this action'
  );
  invariant(state.players[actorId]?.status === 'ACTIVE', 'INVALID_ACTION', 'Player is not active');
}

function assertPhase(state: GameState, phases: readonly GamePhase[]): void {
  invariant(
    phases.includes(state.phase),
    'INVALID_PHASE',
    `Action is not allowed during ${state.phase}`
  );
}

function activity(
  state: GameState,
  context: EngineContext,
  type: string,
  message: string,
  playerId?: string
): GameState {
  const entry = {
    id: context.idFactory(),
    timestamp: context.now,
    type,
    message,
    ...(playerId ? { playerId } : {})
  };
  return { ...state, activity: [...state.activity, entry] };
}

function setPlayer(state: GameState, player: PlayerState): GameState {
  return { ...state, players: { ...state.players, [player.id]: player } };
}

function updatePlayer(
  state: GameState,
  playerId: string,
  update: (player: PlayerState) => PlayerState
): GameState {
  const player = state.players[playerId];
  invariant(player, 'NOT_FOUND', 'Player not found');
  return setPlayer(state, update(player));
}

function setProperty(state: GameState, property: PropertyState): GameState {
  return { ...state, properties: { ...state.properties, [property.propertyId]: property } };
}

function finish(state: GameState, context: EngineContext): GameState {
  return { ...state, revision: state.revision + 1, updatedAt: context.now };
}

function beginDebt(state: GameState, due: PaymentDue, context: EngineContext): GameState {
  return activity(
    { ...state, phase: 'PAYMENT', paymentDue: due },
    context,
    'PAYMENT_DUE',
    `${state.players[due.debtorId]?.name ?? due.debtorId} must raise ${due.amount}`,
    due.debtorId
  );
}

function payOrCreateDebt(
  state: GameState,
  debtorId: string,
  creditorId: string | null,
  amount: number,
  reason: PaymentDue['reason'],
  type: TransactionType,
  context: EngineContext
): GameState {
  const debtor = state.players[debtorId];
  invariant(debtor, 'NOT_FOUND', 'Debtor not found');
  if (amount <= 0) return { ...state, phase: 'TURN_END' };
  if (debtor.cash < amount)
    return beginDebt(
      state,
      { debtorId, creditorId, amount, reason, transactionType: type },
      context
    );
  return {
    ...postTransaction(
      state,
      { fromPlayerId: debtorId, toPlayerId: creditorId, amount, type },
      context
    ),
    phase: 'TURN_END'
  };
}

interface MovementResult {
  readonly state: GameState;
  readonly stoppedForFlight: boolean;
}

function movePlayer(
  state: GameState,
  map: MapConfig,
  playerId: string,
  steps: number,
  pathChoices: readonly string[],
  context: EngineContext,
  initialTrace?: readonly string[],
  mode: 'GROUND' | 'FLIGHT' = 'GROUND'
): MovementResult {
  let result = state;
  let position = result.players[playerId]?.positionTileId;
  invariant(position, 'NOT_FOUND', 'Moving player not found');
  const trace = initialTrace?.length ? [...initialTrace] : [position];
  let choiceIndex = 0;
  for (let step = 0; step < steps; step++) {
    const currentTile = getTile(map, position);
    let next = currentTile.next[0];
    if (currentTile.next.length > 1) {
      next = pathChoices[choiceIndex++];
      invariant(
        next && currentTile.next.includes(next),
        'VALIDATION_FAILED',
        `A valid path choice is required at ${currentTile.id}`
      );
    }
    invariant(next, 'VALIDATION_FAILED', `No path from ${currentTile.id}`);
    position = next;
    trace.push(next);
    result = updatePlayer(result, playerId, (player) => ({
      ...player,
      positionTileId: next as string
    }));
    if (position === map.startTileId) {
      result = postTransaction(
        result,
        {
          fromPlayerId: null,
          toPlayerId: playerId,
          amount: result.rules.salaryOnPassStart,
          type: 'PASS_START'
        },
        context
      );
      result = activity(
        result,
        context,
        'PASS_START',
        `${result.players[playerId]?.name ?? playerId} collected ${result.rules.salaryOnPassStart}`,
        playerId
      );
    }
    const reachedTile = getTile(map, position);
    if (reachedTile.type === 'TELEPORT' && reachedTile.flightOptions?.length) {
      return {
        stoppedForFlight: true,
        state: activity(
          {
            ...result,
            phase: 'FLIGHT_DECISION',
            pendingFlightDecision: {
              playerId,
              airportTileId: reachedTile.id,
              remainingSteps: steps - step - 1,
              options: reachedTile.flightOptions
            },
            lastMovement: {
              id: context.idFactory(),
              playerId,
              tileIds: trace,
              mode
            }
          },
          context,
          'FLIGHT_OFFERED',
          `${result.players[playerId]?.name ?? playerId} reached ${reachedTile.name}`,
          playerId
        )
      };
    }
  }
  return {
    stoppedForFlight: false,
    state: {
      ...result,
      lastMovement: {
        id: context.idFactory(),
        playerId,
        tileIds: trace,
        mode
      }
    }
  };
}

function consumeShield(state: GameState, playerId: string): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    effects: player.effects
      .map((effect) =>
        effect.type === 'RENT_SHIELD'
          ? { ...effect, remainingTurns: effect.remainingTurns - 1 }
          : effect
      )
      .filter((effect) => effect.remainingTurns > 0)
  }));
}

function applyEvent(
  state: GameState,
  map: MapConfig,
  event: EventDefinition,
  playerId: string,
  context: EngineContext
): GameState {
  let result = activity({ ...state, phase: 'CARD_EVENT' }, context, 'EVENT', event.name, playerId);
  const effect = event.effect;
  if (effect.kind === 'CASH') {
    if (effect.amount >= 0) {
      result = postTransaction(
        result,
        {
          fromPlayerId: null,
          toPlayerId: playerId,
          amount: effect.amount,
          type: 'EVENT',
          metadata: { eventId: event.id }
        },
        context
      );
      return { ...result, phase: 'TURN_END' };
    }
    return payOrCreateDebt(result, playerId, null, -effect.amount, 'EVENT', 'EVENT', context);
  }
  if (effect.kind === 'PERCENT_CASH') {
    const cash = result.players[playerId]?.cash ?? 0;
    const amount = Math.round(Math.abs((cash * effect.percent) / 100));
    if (amount === 0) return { ...result, phase: 'TURN_END' };
    if (effect.percent > 0)
      return {
        ...postTransaction(
          result,
          {
            fromPlayerId: null,
            toPlayerId: playerId,
            amount,
            type: 'EVENT',
            metadata: { eventId: event.id }
          },
          context
        ),
        phase: 'TURN_END'
      };
    return payOrCreateDebt(result, playerId, null, amount, 'EVENT', 'EVENT', context);
  }
  if (effect.kind === 'ACTIVE_EFFECT') {
    result = updatePlayer(result, playerId, (player) => ({
      ...player,
      effects: [...player.effects, effect.effect]
    }));
    return { ...result, phase: 'TURN_END' };
  }
  if (effect.kind === 'ALL_PLAYERS_CASH') {
    for (const player of Object.values(result.players).filter(
      (candidate) => candidate.status === 'ACTIVE'
    )) {
      if (effect.amount > 0)
        result = postTransaction(
          result,
          {
            fromPlayerId: null,
            toPlayerId: player.id,
            amount: effect.amount,
            type: 'EVENT',
            metadata: { eventId: event.id }
          },
          context
        );
      else if (player.cash > 0)
        result = postTransaction(
          result,
          {
            fromPlayerId: player.id,
            toPlayerId: null,
            amount: Math.min(player.cash, -effect.amount),
            type: 'EVENT',
            metadata: { eventId: event.id }
          },
          context
        );
    }
    return { ...result, phase: 'TURN_END' };
  }
  result = updatePlayer(result, playerId, (player) => ({
    ...player,
    positionTileId: effect.tileId
  }));
  if (effect.collectSalary && effect.tileId === map.startTileId) {
    result = postTransaction(
      result,
      {
        fromPlayerId: null,
        toPlayerId: playerId,
        amount: result.rules.salaryOnPassStart,
        type: 'PASS_START'
      },
      context
    );
  }
  return { ...result, phase: 'TURN_END' };
}

function drawEvent(
  state: GameState,
  map: MapConfig,
  playerId: string,
  context: EngineContext
): GameState {
  if (!state.rules.eventDeckEnabled || state.eventDeck.length === 0)
    return { ...state, phase: 'TURN_END' };
  const eventId = state.eventDeck[0];
  invariant(eventId, 'NOT_FOUND', 'Event deck is empty');
  const event = EVENT_DEFINITIONS_BY_ID[eventId];
  invariant(event, 'NOT_FOUND', `Unknown event ${eventId}`);
  const cycled = {
    ...state,
    eventDeck: [...state.eventDeck.slice(1), eventId],
    eventDiscard: [...state.eventDiscard, eventId]
  };
  return applyEvent(cycled, map, event, playerId, context);
}

function resolveLanding(
  state: GameState,
  map: MapConfig,
  playerId: string,
  context: EngineContext
): GameState {
  const player = state.players[playerId];
  invariant(player, 'NOT_FOUND', 'Player not found');
  const tile = getTile(map, player.positionTileId);
  let result = activity(
    { ...state, phase: 'LANDING' },
    context,
    'LANDING',
    `${player.name} landed on ${tile.name}`,
    playerId
  );
  switch (tile.type) {
    case 'PROPERTY': {
      invariant(tile.propertyId, 'VALIDATION_FAILED', 'Property tile is not configured');
      const property = result.properties[tile.propertyId];
      invariant(property, 'NOT_FOUND', 'Property state not found');
      if (!property.ownerId)
        return {
          ...result,
          phase: 'PROPERTY_DECISION',
          pendingPropertyDecision: { playerId, propertyId: property.propertyId }
        };
      if (property.ownerId === playerId || property.mortgaged)
        return { ...result, phase: 'TURN_END' };
      if (player.effects.some((effect) => effect.type === 'RENT_SHIELD')) {
        result = consumeShield(result, playerId);
        return activity(
          { ...result, phase: 'TURN_END' },
          context,
          'RENT_SHIELDED',
          `${player.name} blocked the rent`,
          playerId
        );
      }
      const rent = calculateRent(result, map, property);
      result = payOrCreateDebt(result, playerId, property.ownerId, rent, 'RENT', 'RENT', context);
      if (!result.paymentDue && rent > 0) {
        result = updatePlayer(result, playerId, (value) => ({
          ...value,
          stats: { ...value.stats, rentPaid: value.stats.rentPaid + rent }
        }));
        result = updatePlayer(result, property.ownerId, (value) => ({
          ...value,
          stats: { ...value.stats, rentEarned: value.stats.rentEarned + rent }
        }));
      }
      return result;
    }
    case 'TAX': {
      if (player.effects.some((effect) => effect.type === 'TAX_IMMUNITY'))
        return { ...result, phase: 'TURN_END' };
      return payOrCreateDebt(result, playerId, null, tile.amount ?? 0, 'TAX', 'TAX', context);
    }
    case 'BONUS': {
      const amount = tile.amount ?? 0;
      if (amount > 0)
        result = postTransaction(
          result,
          { fromPlayerId: null, toPlayerId: playerId, amount, type: 'BONUS' },
          context
        );
      return { ...result, phase: 'TURN_END' };
    }
    case 'EVENT':
      return drawEvent(result, map, playerId, context);
    case 'GO_TO_JAIL': {
      const destination = tile.destinationTileId ?? map.jailTileId;
      result = updatePlayer(result, playerId, (value) => ({
        ...value,
        positionTileId: destination,
        jailedTurns: result.rules.jailTurns
      }));
      return { ...result, phase: 'TURN_END' };
    }
    case 'TELEPORT': {
      if (tile.flightOptions?.length)
        return {
          ...result,
          phase: 'FLIGHT_DECISION',
          pendingFlightDecision: {
            playerId,
            airportTileId: tile.id,
            remainingSteps: 0,
            options: tile.flightOptions
          }
        };
      if (!tile.destinationTileId) return { ...result, phase: 'TURN_END' };
      result = updatePlayer(result, playerId, (value) => ({
        ...value,
        positionTileId: tile.destinationTileId as string
      }));
      return resolveLanding(result, map, playerId, context);
    }
    default:
      return { ...result, phase: 'TURN_END' };
  }
}

function decrementEffects(effects: readonly ActiveEffect[]): readonly ActiveEffect[] {
  return effects
    .map((effect) =>
      effect.type === 'RENT_SHIELD'
        ? effect
        : { ...effect, remainingTurns: effect.remainingTurns - 1 }
    )
    .filter((effect) => effect.remainingTurns > 0);
}

function determineTimedWinner(state: GameState, map: MapConfig): readonly string[] {
  const active = state.turnOrder.filter((id) => state.players[id]?.status === 'ACTIVE');
  const worth = active
    .map((id) => ({ id, worth: calculateNetWorth(state, map, id) }))
    .sort((a, b) => b.worth - a.worth);
  const best = worth[0]?.worth;
  return worth.filter((entry) => entry.worth === best).map((entry) => entry.id);
}

function determineTeamWinner(state: GameState, map: MapConfig): readonly string[] {
  const active = state.turnOrder.filter((id) => state.players[id]?.status === 'ACTIVE');
  const totals = new Map<string, number>();
  for (const id of active) {
    const teamId = state.players[id]?.teamId ?? id;
    totals.set(teamId, (totals.get(teamId) ?? 0) + calculateNetWorth(state, map, id));
  }
  const best = Math.max(...totals.values());
  const winningTeams = new Set(
    [...totals].filter(([, total]) => total === best).map(([teamId]) => teamId)
  );
  return active.filter((id) => winningTeams.has(state.players[id]?.teamId ?? id));
}

function checkVictory(state: GameState, map: MapConfig): GameState {
  const active = state.turnOrder.filter((id) => state.players[id]?.status === 'ACTIVE');
  if (active.length <= 1) return { ...state, phase: 'GAME_OVER', winnerIds: active };
  if (state.rules.victoryMode === 'TEAM_NET_WORTH') {
    const activeTeams = new Set(active.map((id) => state.players[id]?.teamId ?? id));
    if (activeTeams.size <= 1) return { ...state, phase: 'GAME_OVER', winnerIds: active };
  }
  if (state.rules.victoryMode === 'NET_WORTH_TARGET' && state.rules.netWorthTarget !== null) {
    const reached = active.filter(
      (id) => calculateNetWorth(state, map, id) >= (state.rules.netWorthTarget as number)
    );
    if (reached.length > 0)
      return { ...state, phase: 'GAME_OVER', winnerIds: determineTimedWinner(state, map) };
  }
  if (state.rules.maxRounds !== null && state.round > state.rules.maxRounds)
    return {
      ...state,
      phase: 'GAME_OVER',
      winnerIds:
        state.rules.victoryMode === 'TEAM_NET_WORTH'
          ? determineTeamWinner(state, map)
          : determineTimedWinner(state, map)
    };
  return state;
}

function advanceTurn(state: GameState, map: MapConfig, context: EngineContext): GameState {
  const outgoingId = currentPlayerId(state);
  let result = updatePlayer(state, outgoingId, (player) => ({
    ...player,
    effects: decrementEffects(player.effects)
  }));
  let index = result.currentPlayerIndex;
  let round = result.round;
  do {
    index = (index + 1) % result.turnOrder.length;
    if (index === 0) round++;
  } while (result.players[result.turnOrder[index] as string]?.status !== 'ACTIVE');
  const startedNewRound = round > result.round;
  if (startedNewRound && result.rules.roundCashSwing > 0) {
    const gain = context.random.nextInt(0, 1) === 1;
    const amount = result.rules.roundCashSwing;
    for (const playerId of result.turnOrder) {
      if (result.players[playerId]?.status !== 'ACTIVE') continue;
      result = updatePlayer(result, playerId, (player) => ({
        ...player,
        cash: gain ? player.cash + amount : Math.max(0, player.cash - amount)
      }));
    }
    result = activity(
      result,
      context,
      'CHAOS_MARKET',
      `Mercado caótico: cada jugador ${gain ? 'recibe' : 'pierde'} $${amount}`
    );
  }
  if (startedNewRound && result.rules.roundLevy > 0) {
    const richest = result.turnOrder
      .filter((id) => result.players[id]?.status === 'ACTIVE')
      .map((id) => ({ id, worth: calculateNetWorth(result, map, id) }))
      .sort((a, b) => b.worth - a.worth)[0];
    if (richest) {
      const amount = Math.min(result.rules.roundLevy, result.players[richest.id]?.cash ?? 0);
      if (amount > 0)
        result = updatePlayer(result, richest.id, (player) => ({
          ...player,
          cash: player.cash - amount
        }));
      result = activity(
        result,
        context,
        'SURVIVAL_LEVY',
        `${result.players[richest.id]?.name ?? richest.id} paga $${amount} al fondo de supervivencia`,
        richest.id
      );
    }
  }
  result = {
    ...result,
    currentPlayerIndex: index,
    round,
    phase: 'TURN_START',
    turnStartedAt: context.now,
    lastRoll: null,
    pendingPropertyDecision: null,
    paymentDue: null
  };
  return checkVictory(result, map);
}

function validateBundle(state: GameState, ownerId: string, bundle: TradeAssetBundle): void {
  invariant(
    Number.isSafeInteger(bundle.cash) && bundle.cash >= 0,
    'VALIDATION_FAILED',
    'Trade cash must be a non-negative integer'
  );
  invariant(
    new Set(bundle.propertyIds).size === bundle.propertyIds.length,
    'VALIDATION_FAILED',
    'Trade properties must be unique'
  );
  invariant(
    new Set(bundle.resources).size === bundle.resources.length,
    'VALIDATION_FAILED',
    'Trade resources must be unique'
  );
  invariant(
    (state.players[ownerId]?.cash ?? -1) >= bundle.cash,
    'INSUFFICIENT_FUNDS',
    'Trade cash is no longer available'
  );
  for (const propertyId of bundle.propertyIds)
    invariant(
      state.properties[propertyId]?.ownerId === ownerId,
      'NOT_OWNER',
      `${ownerId} does not own ${propertyId}`
    );
  for (const resource of bundle.resources)
    invariant(
      state.players[ownerId]?.resources.includes(resource),
      'NOT_OWNER',
      `${ownerId} does not own resource ${resource}`
    );
}

function executeTrade(state: GameState, trade: TradeOffer, context: EngineContext): GameState {
  validateBundle(state, trade.proposerId, trade.offered);
  validateBundle(state, trade.recipientId, trade.requested);
  let result = state;
  if (trade.offered.cash > 0)
    result = postTransaction(
      result,
      {
        fromPlayerId: trade.proposerId,
        toPlayerId: trade.recipientId,
        amount: trade.offered.cash,
        type: 'TRADE',
        metadata: { tradeId: trade.id }
      },
      context
    );
  if (trade.requested.cash > 0)
    result = postTransaction(
      result,
      {
        fromPlayerId: trade.recipientId,
        toPlayerId: trade.proposerId,
        amount: trade.requested.cash,
        type: 'TRADE',
        metadata: { tradeId: trade.id }
      },
      context
    );
  for (const propertyId of trade.offered.propertyIds)
    result = setProperty(result, {
      ...(result.properties[propertyId] as PropertyState),
      ownerId: trade.recipientId
    });
  for (const propertyId of trade.requested.propertyIds)
    result = setProperty(result, {
      ...(result.properties[propertyId] as PropertyState),
      ownerId: trade.proposerId
    });
  result = updatePlayer(result, trade.proposerId, (player) => ({
    ...player,
    resources: [
      ...player.resources.filter((resource) => !trade.offered.resources.includes(resource)),
      ...trade.requested.resources
    ]
  }));
  result = updatePlayer(result, trade.recipientId, (player) => ({
    ...player,
    resources: [
      ...player.resources.filter((resource) => !trade.requested.resources.includes(resource)),
      ...trade.offered.resources
    ]
  }));
  result = updatePlayer(result, trade.proposerId, (player) => ({
    ...player,
    stats: { ...player.stats, tradesCompleted: player.stats.tradesCompleted + 1 }
  }));
  result = updatePlayer(result, trade.recipientId, (player) => ({
    ...player,
    stats: { ...player.stats, tradesCompleted: player.stats.tradesCompleted + 1 }
  }));
  return {
    ...result,
    trades: { ...result.trades, [trade.id]: { ...trade, status: 'ACCEPTED' } },
    activeTradeId: null,
    phase: result.resumePhase ?? 'TURN_END',
    resumePhase: null
  };
}

function closeAuction(state: GameState, map: MapConfig, context: EngineContext): GameState {
  const auction = state.auction;
  invariant(auction, 'INVALID_ACTION', 'There is no active auction');
  let result = state;
  if (auction.highestBidderId && auction.currentBid > 0) {
    result = postTransaction(
      result,
      {
        fromPlayerId: auction.highestBidderId,
        toPlayerId: null,
        amount: auction.currentBid,
        type: 'AUCTION_PURCHASE',
        metadata: { propertyId: auction.propertyId }
      },
      context
    );
    const property = result.properties[auction.propertyId];
    invariant(property, 'NOT_FOUND', 'Auction property not found');
    result = setProperty(result, { ...property, ownerId: auction.highestBidderId });
    result = updatePlayer(result, auction.highestBidderId, (player) => ({
      ...player,
      stats: { ...player.stats, propertiesPurchased: player.stats.propertiesPurchased + 1 }
    }));
    result = activity(
      result,
      context,
      'AUCTION_WON',
      `${result.players[auction.highestBidderId]?.name ?? auction.highestBidderId} won the auction for ${auction.currentBid}`,
      auction.highestBidderId
    );
  }
  return { ...result, auction: null, phase: 'TURN_END', pendingPropertyDecision: null };
}

function handleAction(
  state: GameState,
  action: GameAction,
  map: MapConfig,
  context: EngineContext
): GameState {
  switch (action.type) {
    case 'START_GAME': {
      assertPhase(state, ['LOBBY']);
      invariant(
        state.turnOrder[0] === action.actorId,
        'INVALID_ACTION',
        'Only the first player may start the game'
      );
      return activity(
        { ...state, phase: 'TURN_START', turnStartedAt: context.now },
        context,
        'GAME_STARTED',
        'The game started',
        action.actorId
      );
    }
    case 'ROLL_DICE': {
      assertPhase(state, ['TURN_START', 'JAIL']);
      assertCurrentPlayer(state, action.actorId);
      const dice: readonly [number, number] = [
        context.random.nextInt(1, 6),
        context.random.nextInt(1, 6)
      ];
      const roll: DiceRoll = { dice, total: dice[0] + dice[1], doubles: dice[0] === dice[1] };
      let result = updatePlayer(
        { ...state, phase: 'ROLLING', lastRoll: roll },
        action.actorId,
        (player) => ({
          ...player,
          stats: { ...player.stats, totalRolled: player.stats.totalRolled + roll.total }
        })
      );
      result = activity(
        result,
        context,
        'DICE_ROLL',
        `${result.players[action.actorId]?.name ?? action.actorId} rolled ${roll.total}`,
        action.actorId
      );
      const player = result.players[action.actorId] as PlayerState;
      if (player.jailedTurns > 0 && !roll.doubles) {
        result = updatePlayer(result, action.actorId, (value) => ({
          ...value,
          jailedTurns: value.jailedTurns - 1
        }));
        return { ...result, phase: 'TURN_END' };
      }
      if (player.jailedTurns > 0)
        result = updatePlayer(result, action.actorId, (value) => ({ ...value, jailedTurns: 0 }));
      const movement = movePlayer(
        { ...result, phase: 'MOVING' },
        map,
        action.actorId,
        roll.total,
        action.pathChoices ?? [],
        context
      );
      if (movement.stoppedForFlight) return movement.state;
      return resolveLanding(movement.state, map, action.actorId, context);
    }
    case 'TAKE_FLIGHT': {
      assertPhase(state, ['FLIGHT_DECISION']);
      assertCurrentPlayer(state, action.actorId);
      const pending = state.pendingFlightDecision;
      invariant(pending?.playerId === action.actorId, 'INVALID_ACTION', 'No flight decision');
      const option = pending.options.find(
        (candidate) => candidate.destinationTileId === action.destinationTileId
      );
      invariant(option, 'VALIDATION_FAILED', 'That flight is not available');
      const player = state.players[action.actorId];
      invariant(
        player && player.cash >= option.fee,
        'INSUFFICIENT_FUNDS',
        'Not enough cash to fly'
      );
      let result = postTransaction(
        state,
        {
          fromPlayerId: action.actorId,
          toPlayerId: null,
          amount: option.fee,
          type: 'FLIGHT',
          metadata: {
            airportTileId: pending.airportTileId,
            destinationTileId: option.destinationTileId
          }
        },
        context
      );
      result = updatePlayer(result, action.actorId, (value) => ({
        ...value,
        positionTileId: option.destinationTileId
      }));
      result = activity(
        {
          ...result,
          phase: 'MOVING',
          pendingFlightDecision: null,
          lastMovement: {
            id: context.idFactory(),
            playerId: action.actorId,
            tileIds: [pending.airportTileId, option.destinationTileId],
            mode: 'FLIGHT'
          }
        },
        context,
        'FLIGHT_TAKEN',
        `${player.name} paid ${option.fee} and flew to ${getTile(map, option.destinationTileId).name}`,
        action.actorId
      );
      if (pending.remainingSteps === 0) return resolveLanding(result, map, action.actorId, context);
      const movement = movePlayer(
        result,
        map,
        action.actorId,
        pending.remainingSteps,
        [],
        context,
        [pending.airportTileId, option.destinationTileId],
        'FLIGHT'
      );
      if (movement.stoppedForFlight) return movement.state;
      return resolveLanding(movement.state, map, action.actorId, context);
    }
    case 'DECLINE_FLIGHT': {
      assertPhase(state, ['FLIGHT_DECISION']);
      assertCurrentPlayer(state, action.actorId);
      const pending = state.pendingFlightDecision;
      invariant(pending?.playerId === action.actorId, 'INVALID_ACTION', 'No flight decision');
      let result = activity(
        { ...state, phase: 'MOVING', pendingFlightDecision: null },
        context,
        'FLIGHT_DECLINED',
        `${state.players[action.actorId]?.name ?? action.actorId} continued by land`,
        action.actorId
      );
      if (pending.remainingSteps === 0) return { ...result, phase: 'TURN_END' };
      const movement = movePlayer(
        result,
        map,
        action.actorId,
        pending.remainingSteps,
        [],
        context,
        [pending.airportTileId]
      );
      if (movement.stoppedForFlight) return movement.state;
      return resolveLanding(movement.state, map, action.actorId, context);
    }
    case 'BUY_PROPERTY': {
      assertPhase(state, ['PROPERTY_DECISION']);
      assertCurrentPlayer(state, action.actorId);
      const pending = state.pendingPropertyDecision;
      invariant(
        pending?.playerId === action.actorId,
        'INVALID_ACTION',
        'No property decision for this player'
      );
      const property = state.properties[pending.propertyId];
      invariant(property && !property.ownerId, 'INVALID_ACTION', 'Property is no longer available');
      const config = getPropertyConfig(map, property.propertyId);
      let result = postTransaction(
        state,
        {
          fromPlayerId: action.actorId,
          toPlayerId: null,
          amount: Math.round(config.purchasePrice * state.rules.propertyPriceMultiplier),
          type: 'PROPERTY_PURCHASE',
          metadata: { propertyId: property.propertyId }
        },
        context
      );
      result = setProperty(result, { ...property, ownerId: action.actorId });
      result = updatePlayer(result, action.actorId, (player) => ({
        ...player,
        stats: { ...player.stats, propertiesPurchased: player.stats.propertiesPurchased + 1 }
      }));
      return activity(
        { ...result, phase: 'TURN_END', pendingPropertyDecision: null },
        context,
        'PROPERTY_BOUGHT',
        `${result.players[action.actorId]?.name ?? action.actorId} bought ${config.name}`,
        action.actorId
      );
    }
    case 'DECLINE_PROPERTY': {
      assertPhase(state, ['PROPERTY_DECISION']);
      assertCurrentPlayer(state, action.actorId);
      const propertyId = state.pendingPropertyDecision?.propertyId;
      invariant(propertyId, 'INVALID_ACTION', 'No property decision');
      if (!state.rules.auctionsEnabled)
        return { ...state, pendingPropertyDecision: null, phase: 'TURN_END' };
      const auction: AuctionState = {
        propertyId,
        startedByPlayerId: action.actorId,
        currentBid: 0,
        highestBidderId: null,
        passedPlayerIds: [],
        endsAt: context.now + state.rules.auctionDurationMs
      };
      return activity(
        { ...state, phase: 'AUCTION', auction, pendingPropertyDecision: null },
        context,
        'AUCTION_STARTED',
        `Auction started for ${getPropertyConfig(map, propertyId).name}`,
        action.actorId
      );
    }
    case 'BID_AUCTION': {
      assertPhase(state, ['AUCTION']);
      const auction = state.auction;
      invariant(auction, 'INVALID_ACTION', 'There is no active auction');
      invariant(context.now < auction.endsAt, 'INVALID_ACTION', 'Auction has ended');
      const bidder = state.players[action.actorId];
      invariant(bidder?.status === 'ACTIVE', 'INVALID_ACTION', 'Only active players can bid');
      invariant(
        !auction.passedPlayerIds.includes(action.actorId),
        'INVALID_ACTION',
        'A player who passed cannot bid again'
      );
      invariant(
        Number.isSafeInteger(action.amount) &&
          action.amount >= auction.currentBid + state.rules.minimumBid,
        'VALIDATION_FAILED',
        'Bid is too low'
      );
      invariant(bidder.cash >= action.amount, 'INSUFFICIENT_FUNDS', 'Bid exceeds available cash');
      return activity(
        {
          ...state,
          auction: { ...auction, currentBid: action.amount, highestBidderId: action.actorId }
        },
        context,
        'AUCTION_BID',
        `${bidder.name} bid ${action.amount}`,
        action.actorId
      );
    }
    case 'PASS_AUCTION': {
      assertPhase(state, ['AUCTION']);
      const auction = state.auction;
      invariant(auction, 'INVALID_ACTION', 'There is no active auction');
      invariant(
        state.players[action.actorId]?.status === 'ACTIVE',
        'INVALID_ACTION',
        'Only active players can pass'
      );
      invariant(
        auction.highestBidderId !== action.actorId,
        'INVALID_ACTION',
        'Highest bidder cannot pass'
      );
      const passed = [...new Set([...auction.passedPlayerIds, action.actorId])];
      let result: GameState = { ...state, auction: { ...auction, passedPlayerIds: passed } };
      const eligible = state.turnOrder.filter(
        (id) => state.players[id]?.status === 'ACTIVE' && id !== auction.highestBidderId
      );
      if (eligible.every((id) => passed.includes(id))) result = closeAuction(result, map, context);
      return result;
    }
    case 'CLOSE_AUCTION': {
      assertPhase(state, ['AUCTION']);
      const auction = state.auction;
      invariant(auction, 'INVALID_ACTION', 'There is no active auction');
      const eligible = state.turnOrder.filter(
        (id) => state.players[id]?.status === 'ACTIVE' && id !== auction.highestBidderId
      );
      invariant(
        context.now >= auction.endsAt ||
          eligible.every((id) => auction.passedPlayerIds.includes(id)),
        'INVALID_ACTION',
        'Auction cannot be closed yet'
      );
      return closeAuction(state, map, context);
    }
    case 'END_TURN': {
      assertPhase(state, ['TURN_END']);
      assertCurrentPlayer(state, action.actorId);
      return advanceTurn(state, map, context);
    }
    case 'MORTGAGE_PROPERTY': {
      assertPhase(state, ['TURN_START', 'TURN_END', 'PAYMENT']);
      const property = state.properties[action.propertyId];
      invariant(
        property?.ownerId === action.actorId,
        'NOT_OWNER',
        'Player does not own this property'
      );
      invariant(
        !property.mortgaged && property.upgradeLevel === 0,
        'INVALID_ACTION',
        'Property cannot be mortgaged'
      );
      const config = getPropertyConfig(map, action.propertyId);
      let result = setProperty(state, { ...property, mortgaged: true });
      result = postTransaction(
        result,
        {
          fromPlayerId: null,
          toPlayerId: action.actorId,
          amount: config.mortgageValue,
          type: 'MORTGAGE',
          metadata: { propertyId: action.propertyId }
        },
        context
      );
      return result;
    }
    case 'UNMORTGAGE_PROPERTY': {
      assertPhase(state, ['TURN_START', 'TURN_END']);
      const property = state.properties[action.propertyId];
      invariant(
        property?.ownerId === action.actorId,
        'NOT_OWNER',
        'Player does not own this property'
      );
      invariant(property.mortgaged, 'INVALID_ACTION', 'Property is not mortgaged');
      let result = postTransaction(
        state,
        {
          fromPlayerId: action.actorId,
          toPlayerId: null,
          amount: unmortgageCost(map, action.propertyId),
          type: 'UNMORTGAGE',
          metadata: { propertyId: action.propertyId }
        },
        context
      );
      result = setProperty(result, { ...property, mortgaged: false });
      return result;
    }
    case 'BUILD_UPGRADE': {
      assertPhase(state, ['TURN_START', 'TURN_END']);
      const property = state.properties[action.propertyId];
      invariant(
        property?.ownerId === action.actorId,
        'NOT_OWNER',
        'Player does not own this property'
      );
      invariant(
        !property.mortgaged && property.upgradeLevel < state.rules.maxUpgradeLevel,
        'INVALID_ACTION',
        'Property cannot be upgraded'
      );
      const config = getPropertyConfig(map, action.propertyId);
      invariant(
        config.upgradeCost > 0 && ownerHasCompleteGroup(state, map, action.actorId, config.group),
        'INVALID_ACTION',
        'A complete group is required to upgrade'
      );
      invariant(
        map.properties
          .filter((item) => item.group === config.group)
          .every((item) => !state.properties[item.id]?.mortgaged),
        'INVALID_ACTION',
        'A mortgaged group cannot be upgraded'
      );
      let result = postTransaction(
        state,
        {
          fromPlayerId: action.actorId,
          toPlayerId: null,
          amount: config.upgradeCost,
          type: 'UPGRADE_PURCHASE',
          metadata: { propertyId: action.propertyId }
        },
        context
      );
      result = setProperty(result, { ...property, upgradeLevel: property.upgradeLevel + 1 });
      return result;
    }
    case 'SELL_UPGRADE': {
      assertPhase(state, ['TURN_START', 'TURN_END', 'PAYMENT']);
      const property = state.properties[action.propertyId];
      invariant(
        property?.ownerId === action.actorId,
        'NOT_OWNER',
        'Player does not own this property'
      );
      invariant(property.upgradeLevel > 0, 'INVALID_ACTION', 'Property has no upgrades');
      const value = Math.floor(getPropertyConfig(map, action.propertyId).upgradeCost / 2);
      let result = setProperty(state, { ...property, upgradeLevel: property.upgradeLevel - 1 });
      result = postTransaction(
        result,
        {
          fromPlayerId: null,
          toPlayerId: action.actorId,
          amount: value,
          type: 'UPGRADE_SALE',
          metadata: { propertyId: action.propertyId }
        },
        context
      );
      return result;
    }
    case 'SETTLE_DEBT': {
      assertPhase(state, ['PAYMENT']);
      const due = state.paymentDue;
      invariant(due?.debtorId === action.actorId, 'INVALID_ACTION', 'Player has no debt to settle');
      let result = postTransaction(
        state,
        {
          fromPlayerId: due.debtorId,
          toPlayerId: due.creditorId,
          amount: due.amount,
          type: due.transactionType
        },
        context
      );
      if (due.reason === 'RENT' && due.creditorId) {
        result = updatePlayer(result, due.debtorId, (player) => ({
          ...player,
          stats: { ...player.stats, rentPaid: player.stats.rentPaid + due.amount }
        }));
        result = updatePlayer(result, due.creditorId, (player) => ({
          ...player,
          stats: { ...player.stats, rentEarned: player.stats.rentEarned + due.amount }
        }));
      }
      return { ...result, paymentDue: null, phase: 'TURN_END' };
    }
    case 'DECLARE_BANKRUPTCY': {
      assertPhase(state, ['PAYMENT']);
      const due = state.paymentDue;
      invariant(
        due?.debtorId === action.actorId,
        'INVALID_ACTION',
        'Only the debtor may declare bankruptcy'
      );
      const debtor = state.players[action.actorId] as PlayerState;
      let result = state;
      if (debtor.cash > 0)
        result = postTransaction(
          result,
          {
            fromPlayerId: debtor.id,
            toPlayerId: due.creditorId,
            amount: debtor.cash,
            type: 'BANKRUPTCY'
          },
          context
        );
      for (const property of Object.values(result.properties).filter(
        (item) => item.ownerId === debtor.id
      )) {
        result = setProperty(
          result,
          due.creditorId
            ? { ...property, ownerId: due.creditorId }
            : { ...property, ownerId: null, mortgaged: false, upgradeLevel: 0 }
        );
      }
      if (due.creditorId && debtor.resources.length > 0) {
        result = updatePlayer(result, due.creditorId, (player) => ({
          ...player,
          resources: [...player.resources, ...debtor.resources]
        }));
      }
      result = updatePlayer(result, debtor.id, (player) => ({
        ...player,
        cash: 0,
        status: 'BANKRUPT',
        jailedTurns: 0,
        effects: [],
        resources: []
      }));
      result = activity(
        { ...result, paymentDue: null, phase: 'TURN_END' },
        context,
        'BANKRUPTCY',
        `${debtor.name} is bankrupt`,
        debtor.id
      );
      result = checkVictory(result, map);
      return result.phase === 'GAME_OVER' ? result : advanceTurn(result, map, context);
    }
    case 'FORFEIT_GAME': {
      const player = state.players[action.actorId];
      invariant(player?.status === 'ACTIVE', 'INVALID_ACTION', 'Player is not active');
      const wasCurrentPlayer = currentPlayerId(state) === action.actorId;
      let result = state;
      for (const property of Object.values(result.properties).filter(
        (item) => item.ownerId === action.actorId
      )) {
        result = setProperty(result, {
          ...property,
          ownerId: null,
          mortgaged: false,
          upgradeLevel: 0
        });
      }
      result = updatePlayer(result, action.actorId, (current) => ({
        ...current,
        cash: 0,
        status: 'BANKRUPT',
        jailedTurns: 0,
        effects: [],
        resources: []
      }));
      const trades = Object.fromEntries(
        Object.entries(result.trades).map(([id, trade]) => [
          id,
          trade.status === 'OPEN' &&
          (trade.proposerId === action.actorId || trade.recipientId === action.actorId)
            ? { ...trade, status: 'CANCELLED' as const }
            : trade
        ])
      );
      const activeTrade = result.activeTradeId ? trades[result.activeTradeId] : null;
      const activeTradeCancelled = activeTrade?.status === 'CANCELLED';
      const paymentDue =
        result.paymentDue?.debtorId === action.actorId
          ? null
          : result.paymentDue?.creditorId === action.actorId
            ? { ...result.paymentDue, creditorId: null }
            : result.paymentDue;
      const auction = result.auction
        ? {
            ...result.auction,
            highestBidderId:
              result.auction.highestBidderId === action.actorId
                ? null
                : result.auction.highestBidderId,
            currentBid:
              result.auction.highestBidderId === action.actorId ? 0 : result.auction.currentBid,
            passedPlayerIds: result.auction.passedPlayerIds.includes(action.actorId)
              ? result.auction.passedPlayerIds
              : [...result.auction.passedPlayerIds, action.actorId]
          }
        : null;
      result = activity(
        {
          ...result,
          trades,
          activeTradeId: activeTradeCancelled ? null : result.activeTradeId,
          resumePhase: activeTradeCancelled ? null : result.resumePhase,
          phase: activeTradeCancelled ? (result.resumePhase ?? 'TURN_END') : result.phase,
          pendingPropertyDecision:
            result.pendingPropertyDecision?.playerId === action.actorId
              ? null
              : result.pendingPropertyDecision,
          paymentDue,
          auction
        },
        context,
        'FORFEIT',
        `${player.name} left the game`,
        player.id
      );
      result = checkVictory(result, map);
      if (result.phase === 'GAME_OVER') return result;
      if (!wasCurrentPlayer) return result;
      return advanceTurn(
        {
          ...result,
          phase: 'TURN_END',
          pendingPropertyDecision: null,
          paymentDue: null,
          auction: null,
          activeTradeId: null,
          resumePhase: null
        },
        map,
        context
      );
    }
    case 'OFFER_TRADE': {
      assertPhase(state, ['TURN_START', 'TURN_END']);
      assertCurrentPlayer(state, action.actorId);
      invariant(
        action.recipientId !== action.actorId &&
          state.players[action.recipientId]?.status === 'ACTIVE',
        'VALIDATION_FAILED',
        'Trade recipient must be another active player'
      );
      validateBundle(state, action.actorId, action.offered);
      validateBundle(state, action.recipientId, action.requested);
      const id = context.idFactory();
      const trade: TradeOffer = {
        id,
        proposerId: action.actorId,
        recipientId: action.recipientId,
        offered: action.offered,
        requested: action.requested,
        status: 'OPEN',
        createdAt: context.now
      };
      return activity(
        {
          ...state,
          phase: 'TRADE',
          resumePhase: state.phase,
          activeTradeId: id,
          trades: { ...state.trades, [id]: trade }
        },
        context,
        'TRADE_OFFERED',
        `${state.players[action.actorId]?.name ?? action.actorId} offered a trade`,
        action.actorId
      );
    }
    case 'ACCEPT_TRADE': {
      assertPhase(state, ['TRADE']);
      const trade = state.trades[action.tradeId];
      invariant(
        trade?.status === 'OPEN' &&
          trade.recipientId === action.actorId &&
          state.activeTradeId === trade.id,
        'INVALID_ACTION',
        'Trade cannot be accepted'
      );
      return executeTrade(state, trade, context);
    }
    case 'DECLINE_TRADE': {
      assertPhase(state, ['TRADE']);
      const trade = state.trades[action.tradeId];
      invariant(
        trade?.status === 'OPEN' && trade.recipientId === action.actorId,
        'INVALID_ACTION',
        'Trade cannot be declined'
      );
      return {
        ...state,
        phase: state.resumePhase ?? 'TURN_END',
        resumePhase: null,
        activeTradeId: null,
        trades: { ...state.trades, [trade.id]: { ...trade, status: 'DECLINED' } }
      };
    }
    case 'CANCEL_TRADE': {
      assertPhase(state, ['TRADE']);
      const trade = state.trades[action.tradeId];
      invariant(
        trade?.status === 'OPEN' && trade.proposerId === action.actorId,
        'INVALID_ACTION',
        'Trade cannot be cancelled'
      );
      return {
        ...state,
        phase: state.resumePhase ?? 'TURN_END',
        resumePhase: null,
        activeTradeId: null,
        trades: { ...state.trades, [trade.id]: { ...trade, status: 'CANCELLED' } }
      };
    }
    case 'COUNTER_TRADE': {
      assertPhase(state, ['TRADE']);
      const original = state.trades[action.tradeId];
      invariant(
        original?.status === 'OPEN' && original.recipientId === action.actorId,
        'INVALID_ACTION',
        'Trade cannot be countered'
      );
      validateBundle(state, action.actorId, action.offered);
      validateBundle(state, original.proposerId, action.requested);
      const id = context.idFactory();
      const counter: TradeOffer = {
        id,
        proposerId: action.actorId,
        recipientId: original.proposerId,
        offered: action.offered,
        requested: action.requested,
        status: 'OPEN',
        createdAt: context.now
      };
      return {
        ...state,
        activeTradeId: id,
        trades: {
          ...state.trades,
          [original.id]: { ...original, status: 'COUNTERED' },
          [id]: counter
        }
      };
    }
  }
}

export function applyGameAction(
  state: GameState,
  action: GameAction,
  map: MapConfig,
  context: EngineContext
): GameState {
  invariant(
    state.mapId === map.id,
    'VALIDATION_FAILED',
    `State belongs to map ${state.mapId}, not ${map.id}`
  );
  invariant(
    Number.isSafeInteger(context.now) && context.now >= state.updatedAt,
    'VALIDATION_FAILED',
    'Engine clock cannot move backwards'
  );
  if (action.expectedRevision !== undefined && action.expectedRevision !== state.revision) {
    throw new GameRuleError(
      'STALE_REVISION',
      `Expected revision ${action.expectedRevision}, current revision is ${state.revision}`
    );
  }
  if (state.phase === 'GAME_OVER') throw new GameRuleError('INVALID_PHASE', 'Game is over');
  const next = handleAction(state, action, map, context);
  if (action.type !== 'FORFEIT_GAME') assertPhaseTransition(state.phase, next.phase);
  return finish(next, context);
}

export function getCurrentPlayer(state: GameState): PlayerState {
  const player = state.players[currentPlayerId(state)];
  invariant(player, 'NOT_FOUND', 'Current player not found');
  return player;
}
