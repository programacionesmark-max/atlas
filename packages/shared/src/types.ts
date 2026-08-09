export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type UserId = string;
export type RoomId = string;
export type GameId = string;
export type PlayerId = string;

export const ROOM_VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

export const ROOM_STATUSES = ['LOBBY', 'STARTING', 'IN_GAME', 'FINISHED'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const GAME_MODES = [
  'CLASSIC',
  'BLITZ',
  'CHAOS',
  'TYCOON',
  'TEAMS',
  'BATTLE_ROYALE',
  'DUEL',
  'LAND_RUSH',
  'CUSTOM'
] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const VICTORY_MODES = [
  'LAST_PLAYER_STANDING',
  'MOST_NET_WORTH',
  'NET_WORTH_TARGET',
  'TEAM_NET_WORTH'
] as const;
export type VictoryMode = (typeof VICTORY_MODES)[number];

export const PLAYER_ROLES = ['PLAYER', 'SPECTATOR'] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];

export interface RoomRules {
  startingCash: number;
  turnTimerSeconds: 0 | 15 | 30 | 45 | 60;
  victoryMode: VictoryMode;
  maxRounds: number | null;
  netWorthTarget: number | null;
  auctionsEnabled: boolean;
  tradesEnabled: boolean;
  economicEventsEnabled: boolean;
  doublesExtraRoll: boolean;
}

export interface RoomSettings {
  name: string;
  visibility: RoomVisibility;
  maxPlayers: number;
  mapId: string;
  mode: GameMode;
  allowSpectators: boolean;
  rules: RoomRules;
}

export interface PublicRoomPlayer {
  id: PlayerId;
  userId: UserId;
  nickname: string;
  avatarId: string;
  color: string;
  tokenId: string;
  emoteId: string;
  role: PlayerRole;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  joinedAt: string;
}

export interface PublicRoomSummary {
  id: RoomId;
  code: string;
  name: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  mapId: string;
  mode: GameMode;
  playerCount: number;
  maxPlayers: number;
  requiresPassword: boolean;
  createdAt: string;
}

export interface PublicRoomState extends PublicRoomSummary {
  version: number;
  hostPlayerId: PlayerId;
  settings: RoomSettings;
  players: PublicRoomPlayer[];
  gameId: GameId | null;
}

export interface SessionIdentity {
  userId: UserId;
  playerId: PlayerId;
  nickname: string;
  guest: boolean;
}

export interface SessionReadyPayload {
  identity: SessionIdentity;
  reconnectToken: string;
  resumed: boolean;
  room: PublicRoomState | null;
}

export interface AuthoritativeGameState {
  gameId: GameId;
  roomId: RoomId;
  version: number;
  phase: string;
  currentPlayerId: PlayerId | null;
  state: JsonValue;
  updatedAt: string;
}

export interface GameActionEnvelope {
  actionId: string;
  expectedVersion: number;
  type: string;
  payload?: JsonValue | undefined;
}

export interface GameEventMessage {
  id: string;
  gameId: GameId;
  sequence: number;
  type: string;
  actorPlayerId: PlayerId | null;
  payload: JsonValue;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: RoomId;
  playerId: PlayerId;
  nickname: string;
  text: string;
  createdAt: string;
}

export interface MatchRecapAward {
  id:
    | 'WINNER'
    | 'RICHEST_PLAYER'
    | 'PROPERTY_KING'
    | 'MASTER_TRADER'
    | 'LUCKIEST_PLAYER'
    | 'BIGGEST_SPENDER'
    | 'RENT_COLLECTOR';
  playerId: PlayerId;
  label: string;
  value: number;
}

export interface MatchRecapPlayer {
  playerId: PlayerId;
  nickname: string;
  placement: number;
  status: 'ACTIVE' | 'DISCONNECTED' | 'BANKRUPT';
  finalCash: number;
  netWorth: number;
  propertyValue: number;
  propertiesOwned: number;
  propertiesPurchased: number;
  rentEarned: number;
  rentPaid: number;
  moneyEarned: number;
  moneySpent: number;
  tradesCompleted: number;
  auctionsWon: number;
  auctionSpend: number;
  mortgagesCreated: number;
  mortgagesRecovered: number;
  upgradesPurchased: number;
  totalRolled: number;
  rolls: number;
  averageRoll: number;
  biggestPaymentReceived: number;
  biggestPaymentMade: number;
  bankruptcyCause: string | null;
}

export interface MatchHighlight {
  id: string;
  round: number;
  timestamp: string;
  type: string;
  message: string;
  playerId: PlayerId | null;
}

export interface MatchRecap {
  matchId: GameId;
  gameId: GameId;
  roomId: RoomId;
  roomName: string;
  mapId: string;
  mode: GameMode;
  visibility: RoomVisibility;
  winnerPlayerIds: PlayerId[];
  victoryReason: VictoryMode;
  durationMs: number;
  roundsPlayed: number;
  startedAt: string;
  finishedAt: string;
  players: MatchRecapPlayer[];
  awards: MatchRecapAward[];
  highlights: MatchHighlight[];
}

export interface PlayerCustomization {
  avatarId?: string | undefined;
  color?: string | undefined;
  tokenId?: string | undefined;
  emoteId?: string | undefined;
}

export interface ApiError {
  code:
    | 'BAD_REQUEST'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'RATE_LIMITED'
    | 'ROOM_FULL'
    | 'ROOM_STARTED'
    | 'INVALID_PASSWORD'
    | 'NOT_READY'
    | 'STALE_STATE'
    | 'INTERNAL_ERROR';
  message: string;
  details?: JsonValue;
}

export type Ack<T = void> =
  (T extends void ? { ok: true } : { ok: true; data: T }) | { ok: false; error: ApiError };
