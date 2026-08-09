import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import {
  applyGameAction,
  americasMap,
  asiaPacificMap,
  createGame,
  CryptoRandomSource,
  grandEuropeMap,
  neonCityMap,
  type GameRules,
  type GameState,
  type MapConfig
} from '@circuit/game-engine';
import type {
  AuthoritativeGameState,
  ChatMessage,
  CreateRoomInput,
  GameActionInput,
  GameEventMessage,
  JoinRoomInput,
  ListRoomsInput,
  PlayerCustomization,
  PublicRoomPlayer,
  PublicRoomState,
  PublicRoomSummary,
  QuickPlayInput,
  GameMode,
  RoomSettings
} from '@circuit/shared';

import { toEngineAction } from './action-parser.js';
import { sanitizeChat } from './chat.js';
import type { ServerConfig } from './config.js';
import type { ConnectedSession, ManagedMember, ManagedRoom } from './domain.js';
import { RequestError } from './errors.js';
import type { PersistenceService } from './persistence.js';
import { SlidingWindowRateLimiter } from './rate-limit.js';
import { hashPassword, verifyPassword } from './security.js';
import { SerializedQueue } from './serialized-queue.js';
import { nextTimedGameAction } from './game-timeouts.js';

const PLAYER_COLORS = [
  '#8B5CF6',
  '#22D3EE',
  '#F97316',
  '#10B981',
  '#EC4899',
  '#EAB308',
  '#3B82F6',
  '#EF4444'
];

export function modeRules(settings: RoomSettings): Partial<GameRules> {
  const custom: Partial<GameRules> = {
    startingCash: settings.rules.startingCash,
    turnTimeMs:
      settings.rules.turnTimerSeconds === 0 ? null : settings.rules.turnTimerSeconds * 1000,
    maxRounds: settings.rules.maxRounds,
    victoryMode: settings.rules.victoryMode,
    netWorthTarget: settings.rules.netWorthTarget,
    auctionsEnabled: settings.rules.auctionsEnabled,
    eventDeckEnabled: settings.rules.economicEventsEnabled
  };
  const profiles: Record<Exclude<GameMode, 'CUSTOM'>, Partial<GameRules>> = {
    CLASSIC: { startingCash: 3200, turnTimeMs: 45_000, maxRounds: 30 },
    BLITZ: {
      startingCash: 2400,
      turnTimeMs: 30_000,
      maxRounds: 12,
      victoryMode: 'MOST_NET_WORTH',
      auctionDurationMs: 12_000
    },
    CHAOS: {
      startingCash: 3000,
      turnTimeMs: 30_000,
      maxRounds: 18,
      victoryMode: 'MOST_NET_WORTH',
      eventDeckEnabled: true,
      roundCashSwing: 350,
      rentMultiplier: 1.25
    },
    TYCOON: {
      startingCash: 4500,
      turnTimeMs: 60_000,
      victoryMode: 'NET_WORTH_TARGET',
      netWorthTarget: 12_000,
      maxUpgradeLevel: 5,
      rentMultiplier: 1.15
    },
    TEAMS: {
      startingCash: 3200,
      turnTimeMs: 45_000,
      maxRounds: 24,
      victoryMode: 'TEAM_NET_WORTH'
    },
    BATTLE_ROYALE: {
      startingCash: 2800,
      turnTimeMs: 30_000,
      maxRounds: 20,
      victoryMode: 'MOST_NET_WORTH',
      roundLevy: 250,
      rentMultiplier: 1.2
    },
    DUEL: {
      startingCash: 3000,
      turnTimeMs: 30_000,
      maxRounds: 16,
      victoryMode: 'MOST_NET_WORTH',
      auctionDurationMs: 12_000,
      rentMultiplier: 1.15
    },
    LAND_RUSH: {
      startingCash: 5000,
      turnTimeMs: 45_000,
      maxRounds: 16,
      victoryMode: 'NET_WORTH_TARGET',
      netWorthTarget: 10_000,
      propertyPriceMultiplier: 0.7,
      minimumBid: 25
    }
  };
  return settings.mode === 'CUSTOM' ? custom : { ...custom, ...profiles[settings.mode] };
}

interface RoomManagerEvents {
  roomState: [PublicRoomState];
  roomsChanged: [];
  connectivity: [{ roomId: string; playerId: string; connected: boolean }];
  hostChanged: [{ roomId: string; hostPlayerId: string }];
  gameStarted: [{ roomId: string; state: AuthoritativeGameState }];
  gameState: [{ roomId: string; state: AuthoritativeGameState }];
  gameEvent: [{ roomId: string; event: GameEventMessage }];
  chatMessage: [{ roomId: string; message: ChatMessage }];
}

export class RoomManager extends EventEmitter<RoomManagerEvents> {
  private readonly rooms = new Map<string, ManagedRoom>();
  private readonly roomIdByCode = new Map<string, string>();
  private readonly disconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly gameTimers = new Map<string, NodeJS.Timeout>();
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 10_000);
  private readonly actionLimiter = new SlidingWindowRateLimiter(30, 1_000);

  constructor(
    readonly persistence: PersistenceService,
    private readonly config: ServerConfig
  ) {
    super();
  }

  async initialize(): Promise<void> {
    await this.persistence.initialize();
    for (const room of await this.persistence.recoverRooms()) {
      this.rooms.set(room.id, room);
      this.roomIdByCode.set(room.code, room.id);
      this.scheduleGameTimer(room);
    }
  }

  close(): void {
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    for (const timer of this.gameTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    this.gameTimers.clear();
  }

  listRooms(input: ListRoomsInput): PublicRoomSummary[] {
    return [...this.rooms.values()]
      .filter((room) => room.settings.visibility === 'PUBLIC')
      .filter((room) => !input.onlyJoinable || room.status === 'LOBBY')
      .filter((room) => input.mode === undefined || room.settings.mode === input.mode)
      .filter((room) => input.mapId === undefined || room.settings.mapId === input.mapId)
      .filter((room) => this.playerCount(room) < room.settings.maxPlayers)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, input.limit)
      .map((room) => this.toSummary(room));
  }

  findRoomForPlayer(playerId: string): PublicRoomState | null {
    const room = this.getManagedRoomForPlayer(playerId);
    return room ? this.toPublic(room) : null;
  }

  async createRoom(
    session: ConnectedSession,
    input: CreateRoomInput,
    socketId: string
  ): Promise<PublicRoomState> {
    const existingRoom = this.getManagedRoomForPlayer(session.playerId);
    if (existingRoom)
      throw new RequestError(
        'CONFLICT',
        existingRoom.status === 'IN_GAME' || existingRoom.status === 'STARTING'
          ? 'You already have an active game. Return to it before creating another lobby.'
          : 'Leave the current lobby before creating another.'
      );
    const id = randomUUID();
    const member = this.createMember(session, true, socketId, 0);
    const room: ManagedRoom = {
      id,
      code: this.generateRoomCode(),
      settings: input.settings,
      passwordHash: input.password ? await hashPassword(input.password) : null,
      status: 'LOBBY',
      version: 1,
      hostPlayerId: session.playerId,
      members: new Map([[session.playerId, member]]),
      game: null,
      createdAt: new Date(),
      queue: new SerializedQueue()
    };
    this.rooms.set(id, room);
    this.roomIdByCode.set(room.code, id);
    await this.persistence.saveRoom(room);
    const state = this.toPublic(room);
    this.emit('roomState', state);
    this.emit('roomsChanged');
    return state;
  }

  async joinRoom(
    session: ConnectedSession,
    input: JoinRoomInput,
    socketId: string
  ): Promise<PublicRoomState> {
    const existingRoom = this.getManagedRoomForPlayer(session.playerId);
    const roomId = this.roomIdByCode.get(input.code);
    const room = roomId ? this.rooms.get(roomId) : undefined;
    if (!room) throw new RequestError('NOT_FOUND', 'Room not found');
    if (existingRoom && existingRoom.id !== room.id)
      throw new RequestError('CONFLICT', 'Leave the current room before joining another');
    const existingMember = room.members.get(session.playerId);
    if (existingMember) {
      existingMember.socketIds.add(socketId);
      existingMember.connected = true;
      await this.persistence.saveRoom(room);
      return this.toPublic(room);
    }
    if (room.status !== 'LOBBY' && !input.asSpectator)
      throw new RequestError('ROOM_STARTED', 'This game has already started');
    if (input.asSpectator && !room.settings.allowSpectators)
      throw new RequestError('FORBIDDEN', 'Spectators are disabled');
    if (!input.asSpectator && this.playerCount(room) >= room.settings.maxPlayers)
      throw new RequestError('ROOM_FULL', 'Room is full');
    if (
      room.passwordHash &&
      (!input.password || !(await verifyPassword(input.password, room.passwordHash)))
    ) {
      throw new RequestError('INVALID_PASSWORD', 'Incorrect room password');
    }
    const member = this.createMember(
      session,
      false,
      socketId,
      room.members.size,
      input.asSpectator ? 'SPECTATOR' : 'PLAYER'
    );
    room.members.set(session.playerId, member);
    room.version += 1;
    await this.persistence.saveRoom(room);
    const state = this.toPublic(room);
    this.emit('roomState', state);
    this.emit('roomsChanged');
    return state;
  }

  async quickPlay(
    session: ConnectedSession,
    input: QuickPlayInput,
    socketId: string
  ): Promise<PublicRoomState> {
    const candidate = [...this.rooms.values()].find(
      (room) =>
        room.status === 'LOBBY' &&
        room.settings.visibility === 'PUBLIC' &&
        room.passwordHash === null &&
        room.settings.mode === input.mode &&
        room.settings.mapId === input.mapId &&
        this.playerCount(room) < room.settings.maxPlayers
    );
    if (candidate)
      return this.joinRoom(session, { code: candidate.code, asSpectator: false }, socketId);
    return this.createRoom(session, { settings: this.quickPlaySettings(input) }, socketId);
  }

  async leaveRoom(session: ConnectedSession): Promise<void> {
    const room = this.requireRoomForPlayer(session.playerId);
    await room.queue.run(async () => {
      const member = room.members.get(session.playerId);
      if (!member) return;
      if (room.status === 'IN_GAME') {
        member.connected = false;
        member.socketIds.clear();
      } else {
        room.members.delete(session.playerId);
        await this.persistence.markMemberLeft(room.id, session.playerId);
      }
      room.version += 1;
      if (room.members.size === 0) {
        this.rooms.delete(room.id);
        this.roomIdByCode.delete(room.code);
      } else if (room.hostPlayerId === session.playerId) {
        await this.migrateHost(room);
      }
      if (this.rooms.has(room.id)) {
        await this.persistence.saveRoom(room);
        this.emit('roomState', this.toPublic(room));
      }
      this.emit('roomsChanged');
    });
  }

  async setReady(playerId: string, ready: boolean): Promise<PublicRoomState> {
    const room = this.requireRoomForPlayer(playerId);
    return room.queue.run(async () => {
      if (room.status !== 'LOBBY')
        throw new RequestError('ROOM_STARTED', 'Ready state is locked after the game starts');
      const member = this.requireMember(room, playerId);
      if (member.role !== 'PLAYER')
        throw new RequestError('FORBIDDEN', 'Spectators cannot ready up');
      member.ready = ready;
      room.version += 1;
      return this.saveAndBroadcast(room);
    });
  }

  async updatePlayer(
    playerId: string,
    customization: PlayerCustomization
  ): Promise<PublicRoomState> {
    const room = this.requireRoomForPlayer(playerId);
    return room.queue.run(async () => {
      if (room.status !== 'LOBBY')
        throw new RequestError('ROOM_STARTED', 'Customization is locked after the game starts');
      const member = this.requireMember(room, playerId);
      if (customization.avatarId !== undefined) member.avatarId = customization.avatarId;
      if (customization.color !== undefined) {
        const used = [...room.members.values()].some(
          (other) => other.playerId !== playerId && other.color === customization.color
        );
        if (used) throw new RequestError('CONFLICT', 'That player color is already in use');
        member.color = customization.color;
      }
      if (customization.tokenId !== undefined) member.tokenId = customization.tokenId;
      if (customization.emoteId !== undefined) member.emoteId = customization.emoteId;
      room.version += 1;
      return this.saveAndBroadcast(room);
    });
  }

  async updateSettings(playerId: string, settings: RoomSettings): Promise<PublicRoomState> {
    const room = this.requireRoomForPlayer(playerId);
    return room.queue.run(async () => {
      this.requireHost(room, playerId);
      if (room.status !== 'LOBBY')
        throw new RequestError('ROOM_STARTED', 'Room settings are locked after the game starts');
      if (settings.maxPlayers < this.playerCount(room))
        throw new RequestError('BAD_REQUEST', 'Maximum players is below the current player count');
      room.settings = settings;
      for (const member of room.members.values()) member.ready = false;
      room.version += 1;
      return this.saveAndBroadcast(room);
    });
  }

  async kick(hostPlayerId: string, targetPlayerId: string): Promise<void> {
    const room = this.requireRoomForPlayer(hostPlayerId);
    await room.queue.run(async () => {
      this.requireHost(room, hostPlayerId);
      if (room.status !== 'LOBBY')
        throw new RequestError('ROOM_STARTED', 'Players cannot be kicked after the game starts');
      if (targetPlayerId === hostPlayerId)
        throw new RequestError('BAD_REQUEST', 'The host cannot kick themselves');
      this.requireMember(room, targetPlayerId);
      room.members.delete(targetPlayerId);
      room.version += 1;
      await this.persistence.markMemberLeft(room.id, targetPlayerId);
      await this.saveAndBroadcast(room);
      this.emit('roomsChanged');
    });
  }

  async transferHost(hostPlayerId: string, targetPlayerId: string): Promise<PublicRoomState> {
    const room = this.requireRoomForPlayer(hostPlayerId);
    return room.queue.run(async () => {
      this.requireHost(room, hostPlayerId);
      if (room.status !== 'LOBBY')
        throw new RequestError('ROOM_STARTED', 'Host can only be transferred in the lobby');
      const currentHost = this.requireMember(room, hostPlayerId);
      const nextHost = this.requireMember(room, targetPlayerId);
      if (nextHost.role !== 'PLAYER')
        throw new RequestError('BAD_REQUEST', 'Host must be transferred to a player');
      currentHost.isHost = false;
      nextHost.isHost = true;
      room.hostPlayerId = nextHost.playerId;
      room.version += 1;
      const next = await this.saveAndBroadcast(room);
      this.emit('hostChanged', { roomId: room.id, hostPlayerId: nextHost.playerId });
      return next;
    });
  }

  async startGame(playerId: string): Promise<AuthoritativeGameState> {
    const room = this.requireRoomForPlayer(playerId);
    return room.queue.run(async () => {
      this.requireHost(room, playerId);
      if (room.status !== 'LOBBY') throw new RequestError('CONFLICT', 'Game has already started');
      const players = [...room.members.values()].filter((member) => member.role === 'PLAYER');
      if (players.length < 2)
        throw new RequestError('NOT_READY', 'At least two players are required');
      if (room.settings.mode === 'DUEL' && players.length !== 2)
        throw new RequestError('NOT_READY', 'Duel mode requires exactly two players');
      if (players.some((member) => !member.ready))
        throw new RequestError('NOT_READY', 'Every player must be ready');
      const map = this.resolveMap(room.settings.mapId);
      const gameId = randomUUID();
      const now = Date.now();
      let state = createGame({
        gameId,
        map,
        players: players.map((member, index) => ({
          id: member.playerId,
          name: member.nickname,
          teamId: room.settings.mode === 'TEAMS' ? `team-${index % 2}` : null
        })),
        rules: modeRules(room.settings),
        now
      });
      state = applyGameAction(
        state,
        { type: 'START_GAME', actorId: playerId, expectedRevision: state.revision },
        map,
        this.engineContext()
      );
      room.status = 'IN_GAME';
      room.version += 1;
      room.game = {
        id: gameId,
        state,
        map,
        eventSequence: 0,
        persistedTransactionCount: state.transactions.length,
        handledActionIds: new Set()
      };
      try {
        await this.persistence.createGame(room, map);
      } catch (error) {
        room.status = 'LOBBY';
        room.version -= 1;
        room.game = null;
        throw error;
      }
      const publicState = this.toGameState(room, state);
      this.emit('roomState', this.toPublic(room));
      this.emit('gameStarted', { roomId: room.id, state: publicState });
      this.emit('roomsChanged');
      this.scheduleGameTimer(room);
      return publicState;
    });
  }

  async applyAction(
    playerId: string,
    input: GameActionInput,
    authoritativeTimeout = false
  ): Promise<AuthoritativeGameState> {
    if (!authoritativeTimeout && !this.actionLimiter.consume(playerId))
      throw new RequestError('RATE_LIMITED', 'Too many game actions');
    const room = this.requireRoomForPlayer(playerId);
    if (input.roomId !== room.id)
      throw new RequestError('FORBIDDEN', 'Player does not belong to that room');
    return room.queue.run(async () => {
      const game = room.game;
      if (!game || room.status !== 'IN_GAME') throw new RequestError('CONFLICT', 'No active game');
      if (game.handledActionIds.has(input.action.actionId))
        return this.toGameState(room, game.state);
      if (input.action.expectedVersion !== game.state.revision) {
        throw new RequestError('STALE_STATE', 'Game state is stale', {
          currentVersion: game.state.revision
        });
      }
      const beforeTransactionCount = game.state.transactions.length;
      const action = toEngineAction(input.action, playerId);
      const state = applyGameAction(game.state, action, game.map, this.engineContext());
      const nextEventSequence = game.eventSequence + 1;
      const event: GameEventMessage = {
        id: randomUUID(),
        gameId: game.id,
        sequence: nextEventSequence,
        type: input.action.type,
        actorPlayerId: playerId,
        payload: { actionId: input.action.actionId, payload: input.action.payload ?? null },
        createdAt: new Date(state.updatedAt).toISOString()
      };
      const transactions = state.transactions.slice(beforeTransactionCount);
      const durableCandidate = {
        ...game,
        state,
        eventSequence: nextEventSequence
      };
      await this.persistence.appendAction({ ...room, game: durableCandidate }, event, transactions);
      game.state = state;
      game.handledActionIds.add(input.action.actionId);
      game.eventSequence = nextEventSequence;
      game.persistedTransactionCount += transactions.length;
      if (state.phase === 'GAME_OVER') {
        room.status = 'FINISHED';
        room.version += 1;
        await this.persistence.saveRoom(room);
      }
      const publicState = this.toGameState(room, state);
      this.emit('gameEvent', { roomId: room.id, event });
      this.emit('gameState', { roomId: room.id, state: publicState });
      if (state.phase === 'GAME_OVER') this.emit('roomState', this.toPublic(room));
      this.scheduleGameTimer(room);
      return publicState;
    });
  }

  async rematch(playerId: string, roomId: string): Promise<PublicRoomState> {
    const room = this.requireRoomForPlayer(playerId);
    if (room.id !== roomId) throw new RequestError('FORBIDDEN', 'Player is not in that room');
    return room.queue.run(async () => {
      this.requireHost(room, playerId);
      if (room.status !== 'FINISHED' || room.game?.state.phase !== 'GAME_OVER')
        throw new RequestError('CONFLICT', 'The current match is not finished');
      room.game = null;
      room.status = 'LOBBY';
      room.version += 1;
      for (const member of room.members.values()) member.ready = false;
      await this.persistence.saveRoom(room);
      const state = this.toPublic(room);
      this.emit('roomState', state);
      this.emit('roomsChanged');
      return state;
    });
  }

  sendChat(playerId: string, roomId: string, rawText: string): ChatMessage {
    const room = this.requireRoomForPlayer(playerId);
    if (room.id !== roomId)
      throw new RequestError('FORBIDDEN', 'Player does not belong to that room');
    if (!this.chatLimiter.consume(playerId))
      throw new RequestError('RATE_LIMITED', 'Chat rate limit exceeded');
    const member = this.requireMember(room, playerId);
    const text = sanitizeChat(rawText);
    if (!text) throw new RequestError('BAD_REQUEST', 'Message is empty after sanitization');
    const message: ChatMessage = {
      id: randomUUID(),
      roomId,
      playerId,
      nickname: member.nickname,
      text,
      createdAt: new Date().toISOString()
    };
    this.emit('chatMessage', { roomId, message });
    return message;
  }

  async reconnect(session: ConnectedSession, socketId: string): Promise<PublicRoomState | null> {
    const room = this.getManagedRoomForPlayer(session.playerId);
    if (!room) return null;
    const timer = this.disconnectTimers.get(session.playerId);
    if (timer) clearTimeout(timer);
    this.disconnectTimers.delete(session.playerId);
    const member = this.requireMember(room, session.playerId);
    member.socketIds.add(socketId);
    member.connected = true;
    await this.persistence.saveRoom(room);
    const state = this.toPublic(room);
    this.emit('connectivity', { roomId: room.id, playerId: session.playerId, connected: true });
    this.emit('roomState', state);
    return state;
  }

  disconnect(playerId: string, socketId: string): void {
    const room = this.getManagedRoomForPlayer(playerId);
    const member = room?.members.get(playerId);
    if (!room || !member) return;
    member.socketIds.delete(socketId);
    if (member.socketIds.size > 0) return;
    member.connected = false;
    this.emit('connectivity', { roomId: room.id, playerId, connected: false });
    this.emit('roomState', this.toPublic(room));
    void this.persistence.saveRoom(room);
    const existingTimer = this.disconnectTimers.get(playerId);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(playerId);
      if (room.hostPlayerId === playerId && !member.connected)
        void room.queue.run(() => this.migrateHost(room));
    }, this.config.disconnectGraceMs);
    timer.unref();
    this.disconnectTimers.set(playerId, timer);
  }

  getGameState(roomId: string): AuthoritativeGameState | null {
    const room = this.rooms.get(roomId);
    return room?.game ? this.toGameState(room, room.game.state) : null;
  }

  private scheduleGameTimer(room: ManagedRoom): void {
    const existing = this.gameTimers.get(room.id);
    if (existing) clearTimeout(existing);
    this.gameTimers.delete(room.id);
    if (room.status !== 'IN_GAME' || !room.game) return;
    const timedAction = nextTimedGameAction(room.game.state);
    if (!timedAction) return;
    const timer = setTimeout(
      () => {
        this.gameTimers.delete(room.id);
        const latest = this.rooms.get(room.id);
        if (!latest?.game || latest.status !== 'IN_GAME') return;
        const latestAction = nextTimedGameAction(latest.game.state);
        if (!latestAction || latestAction.type !== timedAction.type) {
          this.scheduleGameTimer(latest);
          return;
        }
        void this.applyAction(
          latestAction.actorId,
          {
            roomId: latest.id,
            action: {
              actionId: randomUUID(),
              expectedVersion: latest.game.state.revision,
              type: latestAction.type,
              ...(latestAction.payload === undefined ? {} : { payload: latestAction.payload })
            }
          },
          true
        ).catch(() => this.scheduleGameTimer(latest));
      },
      Math.max(0, timedAction.dueAt - Date.now())
    );
    timer.unref();
    this.gameTimers.set(room.id, timer);
  }

  private async migrateHost(room: ManagedRoom): Promise<void> {
    const candidates = [...room.members.values()]
      .filter(
        (member) =>
          member.role === 'PLAYER' && member.connected && member.playerId !== room.hostPlayerId
      )
      .sort((left, right) => left.joinedAt.getTime() - right.joinedAt.getTime());
    const nextHost =
      candidates[0] ??
      [...room.members.values()].find((member) => member.playerId !== room.hostPlayerId);
    if (!nextHost) return;
    const previous = room.members.get(room.hostPlayerId);
    if (previous) previous.isHost = false;
    nextHost.isHost = true;
    room.hostPlayerId = nextHost.playerId;
    room.version += 1;
    await this.persistence.saveRoom(room);
    this.emit('hostChanged', { roomId: room.id, hostPlayerId: nextHost.playerId });
    this.emit('roomState', this.toPublic(room));
  }

  private async saveAndBroadcast(room: ManagedRoom): Promise<PublicRoomState> {
    await this.persistence.saveRoom(room);
    const state = this.toPublic(room);
    this.emit('roomState', state);
    return state;
  }

  private engineContext() {
    return { now: Date.now(), random: new CryptoRandomSource(), idFactory: randomUUID };
  }

  private resolveMap(mapId: string): MapConfig {
    const map = [neonCityMap, grandEuropeMap, americasMap, asiaPacificMap].find(
      (candidate) => candidate.id === mapId
    );
    if (map) return map;
    throw new RequestError('BAD_REQUEST', `Map is not available on this server: ${mapId}`);
  }

  private quickPlaySettings(input: QuickPlayInput): RoomSettings {
    return {
      name: 'Quick Play',
      visibility: 'PUBLIC',
      maxPlayers: input.maxPlayers,
      mapId: input.mapId,
      mode: input.mode,
      allowSpectators: true,
      rules: {
        startingCash: 1_500,
        turnTimerSeconds: 45,
        victoryMode: 'LAST_PLAYER_STANDING',
        maxRounds: input.mode === 'BLITZ' ? 20 : null,
        netWorthTarget: null,
        auctionsEnabled: true,
        tradesEnabled: true,
        economicEventsEnabled: true,
        doublesExtraRoll: true
      }
    };
  }

  private createMember(
    session: ConnectedSession,
    isHost: boolean,
    socketId: string,
    colorIndex: number,
    role: ManagedMember['role'] = 'PLAYER'
  ): ManagedMember {
    return {
      id: randomUUID(),
      userId: session.userId,
      playerId: session.playerId,
      nickname: session.nickname,
      role,
      ready: false,
      connected: true,
      isHost,
      avatarId: 'avatar-orbit',
      color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length] ?? '#8B5CF6',
      tokenId: 'token-pulse',
      emoteId: 'emote-gg',
      joinedAt: new Date(),
      socketIds: new Set([socketId])
    };
  }

  private requireRoomForPlayer(playerId: string): ManagedRoom {
    const room = this.getManagedRoomForPlayer(playerId);
    if (!room) throw new RequestError('NOT_FOUND', 'Player is not in a room');
    return room;
  }

  private getManagedRoomForPlayer(playerId: string): ManagedRoom | undefined {
    return [...this.rooms.values()].find((room) => room.members.has(playerId));
  }

  private requireMember(room: ManagedRoom, playerId: string): ManagedMember {
    const member = room.members.get(playerId);
    if (!member) throw new RequestError('FORBIDDEN', 'Player does not belong to this room');
    return member;
  }

  private requireHost(room: ManagedRoom, playerId: string): void {
    if (room.hostPlayerId !== playerId)
      throw new RequestError('FORBIDDEN', 'Only the host can perform this action');
  }

  private playerCount(room: ManagedRoom): number {
    return [...room.members.values()].filter((member) => member.role === 'PLAYER').length;
  }

  private generateRoomCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let code = '';
      const digest = createHash('sha256').update(`${randomUUID()}:${attempt}`).digest();
      for (let index = 0; index < 6; index += 1) code += alphabet[digest[index]! % alphabet.length];
      if (!this.roomIdByCode.has(code)) return code;
    }
    throw new Error('Unable to allocate a unique room code');
  }

  private toPlayer(member: ManagedMember): PublicRoomPlayer {
    return {
      id: member.playerId,
      userId: member.userId,
      nickname: member.nickname,
      avatarId: member.avatarId,
      color: member.color,
      tokenId: member.tokenId,
      emoteId: member.emoteId,
      role: member.role,
      ready: member.ready,
      connected: member.connected,
      isHost: member.isHost,
      joinedAt: member.joinedAt.toISOString()
    };
  }

  private toSummary(room: ManagedRoom): PublicRoomSummary {
    return {
      id: room.id,
      code: room.code,
      name: room.settings.name,
      visibility: room.settings.visibility,
      status: room.status,
      mapId: room.settings.mapId,
      mode: room.settings.mode,
      playerCount: this.playerCount(room),
      maxPlayers: room.settings.maxPlayers,
      requiresPassword: room.passwordHash !== null,
      createdAt: room.createdAt.toISOString()
    };
  }

  private toPublic(room: ManagedRoom): PublicRoomState {
    return {
      ...this.toSummary(room),
      version: room.version,
      hostPlayerId: room.hostPlayerId,
      settings: room.settings,
      players: [...room.members.values()].map((member) => this.toPlayer(member)),
      gameId: room.game?.id ?? null
    };
  }

  private toGameState(room: ManagedRoom, state: GameState): AuthoritativeGameState {
    return {
      gameId: state.gameId,
      roomId: room.id,
      version: state.revision,
      phase: state.phase,
      currentPlayerId: state.turnOrder[state.currentPlayerIndex] ?? null,
      state: JSON.parse(JSON.stringify(state)) as AuthoritativeGameState['state'],
      updatedAt: new Date(state.updatedAt).toISOString()
    };
  }
}
