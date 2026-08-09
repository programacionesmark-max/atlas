import type { GameState, MapConfig } from '@circuit/game-engine';
import type { PlayerRole, RoomSettings, RoomStatus, UserId } from '@circuit/shared';

import type { SerializedQueue } from './serialized-queue.js';

export interface ManagedMember {
  id: string;
  userId: UserId;
  playerId: string;
  nickname: string;
  role: PlayerRole;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  avatarId: string;
  color: string;
  tokenId: string;
  emoteId: string;
  joinedAt: Date;
  socketIds: Set<string>;
}

export interface ManagedGame {
  id: string;
  state: GameState;
  map: MapConfig;
  eventSequence: number;
  persistedTransactionCount: number;
  handledActionIds: Set<string>;
}

export interface ManagedRoom {
  id: string;
  code: string;
  settings: RoomSettings;
  passwordHash: string | null;
  status: RoomStatus;
  version: number;
  hostPlayerId: string;
  members: Map<string, ManagedMember>;
  game: ManagedGame | null;
  createdAt: Date;
  queue: SerializedQueue;
}

export interface ConnectedSession {
  userId: string;
  playerId: string;
  nickname: string;
  guest: boolean;
}
