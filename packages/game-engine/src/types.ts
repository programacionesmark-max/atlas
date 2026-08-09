export type GamePhase =
  | 'LOBBY'
  | 'STARTING'
  | 'TURN_START'
  | 'ROLLING'
  | 'MOVING'
  | 'LANDING'
  | 'PROPERTY_DECISION'
  | 'PAYMENT'
  | 'CARD_EVENT'
  | 'TRADE'
  | 'AUCTION'
  | 'JAIL'
  | 'TURN_END'
  | 'GAME_OVER';

export type TileType =
  | 'START'
  | 'PROPERTY'
  | 'TAX'
  | 'EVENT'
  | 'BONUS'
  | 'JAIL'
  | 'GO_TO_JAIL'
  | 'TELEPORT'
  | 'CASINO'
  | 'MARKET'
  | 'AUCTION'
  | 'SHOP'
  | 'SPECIAL';

export type BoardLayout =
  'SQUARE' | 'CIRCULAR' | 'ISLAND' | 'CITY' | 'HEXAGONAL' | 'CIRCUIT' | 'BRANCHING';
export type VictoryMode =
  'LAST_PLAYER_STANDING' | 'MOST_NET_WORTH' | 'NET_WORTH_TARGET' | 'TEAM_NET_WORTH';
export type PlayerStatus = 'ACTIVE' | 'DISCONNECTED' | 'BANKRUPT';

export interface TileConfig {
  readonly id: string;
  readonly name: string;
  readonly type: TileType;
  readonly next: readonly string[];
  readonly propertyId?: string;
  readonly amount?: number;
  readonly destinationTileId?: string;
  readonly eventDeck?: string;
}

export interface PropertyConfig {
  readonly id: string;
  readonly name: string;
  readonly category: 'PROPERTY' | 'BUSINESS' | 'UTILITY' | 'TRANSIT';
  readonly group: string;
  readonly purchasePrice: number;
  readonly baseRent: number;
  readonly rentLevels: readonly number[];
  readonly mortgageValue: number;
  readonly upgradeCost: number;
  readonly region?: string;
}

export interface MapConfig {
  readonly id: string;
  readonly name: string;
  readonly theme: string;
  readonly layout: BoardLayout;
  readonly startTileId: string;
  readonly jailTileId: string;
  readonly tiles: readonly TileConfig[];
  readonly properties: readonly PropertyConfig[];
  readonly economy: {
    readonly startingCash: number;
    readonly passStartAward: number;
    readonly unmortgageInterestRate: number;
    readonly completeGroupRentMultiplier: number;
  };
  readonly specialRules: readonly string[];
}

export interface GameRules {
  readonly startingCash: number;
  readonly auctionsEnabled: boolean;
  readonly auctionDurationMs: number;
  readonly minimumBid: number;
  readonly turnTimeMs: number | null;
  readonly salaryOnPassStart: number;
  readonly maxRounds: number | null;
  readonly victoryMode: VictoryMode;
  readonly netWorthTarget: number | null;
  readonly eventDeckEnabled: boolean;
  readonly jailTurns: number;
  readonly maxUpgradeLevel: number;
  readonly propertyPriceMultiplier: number;
  readonly rentMultiplier: number;
  readonly roundCashSwing: number;
  readonly roundLevy: number;
}

export interface PlayerState {
  readonly id: string;
  readonly name: string;
  readonly teamId: string | null;
  readonly cash: number;
  readonly positionTileId: string;
  readonly status: PlayerStatus;
  readonly jailedTurns: number;
  readonly effects: readonly ActiveEffect[];
  readonly resources: readonly string[];
  readonly stats: PlayerStats;
}

export interface PlayerStats {
  readonly rentPaid: number;
  readonly rentEarned: number;
  readonly propertiesPurchased: number;
  readonly tradesCompleted: number;
  readonly totalRolled: number;
}

export interface ActiveEffect {
  readonly type: 'RENT_SHIELD' | 'TAX_IMMUNITY' | 'RENT_BOOST' | 'PROPERTY_FREEZE';
  readonly remainingTurns: number;
  readonly multiplier?: number;
  readonly propertyId?: string;
}

export interface PropertyState {
  readonly propertyId: string;
  readonly ownerId: string | null;
  readonly upgradeLevel: number;
  readonly mortgaged: boolean;
}

export type TransactionType =
  | 'STARTING_CASH'
  | 'PASS_START'
  | 'PROPERTY_PURCHASE'
  | 'RENT'
  | 'TAX'
  | 'BONUS'
  | 'EVENT'
  | 'AUCTION_PURCHASE'
  | 'TRADE'
  | 'MORTGAGE'
  | 'UNMORTGAGE'
  | 'UPGRADE_PURCHASE'
  | 'UPGRADE_SALE'
  | 'BANKRUPTCY';

export interface Transaction {
  readonly id: string;
  readonly gameId: string;
  readonly fromPlayerId: string | null;
  readonly toPlayerId: string | null;
  readonly type: TransactionType;
  readonly amount: number;
  readonly timestamp: number;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface ActivityEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly type: string;
  readonly message: string;
  readonly playerId?: string;
}

export interface PaymentDue {
  readonly debtorId: string;
  readonly creditorId: string | null;
  readonly amount: number;
  readonly reason: 'RENT' | 'TAX' | 'EVENT';
  readonly transactionType: TransactionType;
}

export interface AuctionState {
  readonly propertyId: string;
  readonly startedByPlayerId: string;
  readonly currentBid: number;
  readonly highestBidderId: string | null;
  readonly passedPlayerIds: readonly string[];
  readonly endsAt: number;
}

export interface TradeAssetBundle {
  readonly cash: number;
  readonly propertyIds: readonly string[];
  readonly resources: readonly string[];
}

export interface TradeOffer {
  readonly id: string;
  readonly proposerId: string;
  readonly recipientId: string;
  readonly offered: TradeAssetBundle;
  readonly requested: TradeAssetBundle;
  readonly status: 'OPEN' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COUNTERED';
  readonly createdAt: number;
}

export interface DiceRoll {
  readonly dice: readonly [number, number];
  readonly total: number;
  readonly doubles: boolean;
}

export interface PendingPropertyDecision {
  readonly playerId: string;
  readonly propertyId: string;
}

export interface GameState {
  readonly schemaVersion: 1;
  readonly gameId: string;
  readonly mapId: string;
  readonly phase: GamePhase;
  readonly revision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly rules: GameRules;
  readonly players: Readonly<Record<string, PlayerState>>;
  readonly turnOrder: readonly string[];
  readonly currentPlayerIndex: number;
  readonly round: number;
  readonly turnStartedAt: number | null;
  readonly lastRoll: DiceRoll | null;
  readonly properties: Readonly<Record<string, PropertyState>>;
  readonly transactions: readonly Transaction[];
  readonly activity: readonly ActivityEntry[];
  readonly pendingPropertyDecision: PendingPropertyDecision | null;
  readonly paymentDue: PaymentDue | null;
  readonly auction: AuctionState | null;
  readonly trades: Readonly<Record<string, TradeOffer>>;
  readonly activeTradeId: string | null;
  readonly resumePhase: GamePhase | null;
  readonly eventDeck: readonly string[];
  readonly eventDiscard: readonly string[];
  readonly winnerIds: readonly string[];
}

export interface PlayerSeed {
  readonly id: string;
  readonly name: string;
  readonly teamId?: string | null;
}

export interface CreateGameInput {
  readonly gameId: string;
  readonly map: MapConfig;
  readonly players: readonly PlayerSeed[];
  readonly rules?: Partial<GameRules>;
  readonly now: number;
  readonly eventDeck?: readonly string[];
}

export type GameAction =
  | { readonly type: 'START_GAME'; readonly actorId: string; readonly expectedRevision?: number }
  | {
      readonly type: 'ROLL_DICE';
      readonly actorId: string;
      readonly pathChoices?: readonly string[];
      readonly expectedRevision?: number;
    }
  | { readonly type: 'BUY_PROPERTY'; readonly actorId: string; readonly expectedRevision?: number }
  | {
      readonly type: 'DECLINE_PROPERTY';
      readonly actorId: string;
      readonly expectedRevision?: number;
    }
  | { readonly type: 'END_TURN'; readonly actorId: string; readonly expectedRevision?: number }
  | {
      readonly type: 'BID_AUCTION';
      readonly actorId: string;
      readonly amount: number;
      readonly expectedRevision?: number;
    }
  | { readonly type: 'PASS_AUCTION'; readonly actorId: string; readonly expectedRevision?: number }
  | { readonly type: 'CLOSE_AUCTION'; readonly actorId: string; readonly expectedRevision?: number }
  | {
      readonly type: 'MORTGAGE_PROPERTY';
      readonly actorId: string;
      readonly propertyId: string;
      readonly expectedRevision?: number;
    }
  | {
      readonly type: 'UNMORTGAGE_PROPERTY';
      readonly actorId: string;
      readonly propertyId: string;
      readonly expectedRevision?: number;
    }
  | {
      readonly type: 'BUILD_UPGRADE';
      readonly actorId: string;
      readonly propertyId: string;
      readonly expectedRevision?: number;
    }
  | {
      readonly type: 'SELL_UPGRADE';
      readonly actorId: string;
      readonly propertyId: string;
      readonly expectedRevision?: number;
    }
  | { readonly type: 'SETTLE_DEBT'; readonly actorId: string; readonly expectedRevision?: number }
  | {
      readonly type: 'DECLARE_BANKRUPTCY';
      readonly actorId: string;
      readonly expectedRevision?: number;
    }
  | {
      readonly type: 'OFFER_TRADE';
      readonly actorId: string;
      readonly recipientId: string;
      readonly offered: TradeAssetBundle;
      readonly requested: TradeAssetBundle;
      readonly expectedRevision?: number;
    }
  | {
      readonly type: 'ACCEPT_TRADE';
      readonly actorId: string;
      readonly tradeId: string;
      readonly expectedRevision?: number;
    }
  | {
      readonly type: 'DECLINE_TRADE';
      readonly actorId: string;
      readonly tradeId: string;
      readonly expectedRevision?: number;
    }
  | {
      readonly type: 'CANCEL_TRADE';
      readonly actorId: string;
      readonly tradeId: string;
      readonly expectedRevision?: number;
    }
  | {
      readonly type: 'COUNTER_TRADE';
      readonly actorId: string;
      readonly tradeId: string;
      readonly offered: TradeAssetBundle;
      readonly requested: TradeAssetBundle;
      readonly expectedRevision?: number;
    };

export interface EngineContext {
  readonly now: number;
  readonly random: RandomSource;
  readonly idFactory: () => string;
}

export interface RandomSource {
  nextInt(minInclusive: number, maxInclusive: number): number;
}
