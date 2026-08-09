import { createHash, randomUUID } from 'node:crypto';

import {
  connectDatabase,
  prisma,
  type Prisma,
  type TransactionType as DatabaseTransactionType
} from '@circuit/database';
import {
  deserializeGameState,
  type MapConfig,
  type Transaction as EngineTransaction
} from '@circuit/game-engine';
import type { GameEventMessage, JsonValue, MatchRecap, RoomSettings } from '@circuit/shared';

import type { ConnectedSession, ManagedGame, ManagedMember, ManagedRoom } from './domain.js';
import { buildMatchRecap } from './match-recap.js';
import { SerializedQueue } from './serialized-queue.js';

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function stateChecksum(state: unknown): string {
  return createHash('sha256').update(stableJson(state)).digest('hex');
}

function eventActionId(event: GameEventMessage): string | null {
  if (typeof event.payload !== 'object' || event.payload === null || Array.isArray(event.payload))
    return null;
  const actionId = (event.payload as Record<string, JsonValue>).actionId;
  return typeof actionId === 'string' && actionId.length > 0 ? actionId : null;
}

const TRANSACTION_TYPES: Record<EngineTransaction['type'], DatabaseTransactionType> = {
  STARTING_CASH: 'INITIAL_GRANT',
  PASS_START: 'REWARD',
  PROPERTY_PURCHASE: 'PROPERTY_PURCHASE',
  RENT: 'RENT',
  TAX: 'TAX',
  BONUS: 'REWARD',
  EVENT: 'EVENT',
  AUCTION_PURCHASE: 'AUCTION_PURCHASE',
  TRADE: 'TRADE',
  MORTGAGE: 'MORTGAGE',
  UNMORTGAGE: 'UNMORTGAGE',
  UPGRADE_PURCHASE: 'UPGRADE_PURCHASE',
  UPGRADE_SALE: 'UPGRADE_SALE',
  FLIGHT: 'BANK_WITHDRAWAL',
  BANKRUPTCY: 'BANKRUPTCY_TRANSFER'
};

export class PersistenceService {
  private available = false;

  constructor(
    private readonly enabled: boolean,
    private readonly snapshotEveryActions: number,
    private readonly required = false
  ) {}

  get databaseAvailable(): boolean {
    return this.available;
  }

  async isReady(): Promise<boolean> {
    if (!this.available) return !this.required;
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }

  async getMatchRecap(gameId: string, playerId?: string): Promise<MatchRecap | null> {
    if (!this.available) return null;
    const result = await prisma.matchResult.findUnique({
      where: { gameId },
      include: {
        game: {
          include: {
            room: { include: { members: { select: { playerId: true } } } }
          }
        }
      }
    });
    if (!result) return null;
    const canView =
      result.game.room.visibility === 'PUBLIC' ||
      (playerId !== undefined &&
        result.game.room.members.some((member) => member.playerId === playerId));
    if (!canView) return null;
    return result.recap as unknown as MatchRecap;
  }

  async initialize(): Promise<boolean> {
    if (!this.enabled) return false;
    if (!process.env.DATABASE_URL) {
      if (this.required)
        throw new Error('DATABASE_URL is required when durable persistence is enabled');
      return false;
    }
    this.available = await connectDatabase();
    if (!this.available && this.required)
      throw new Error('PostgreSQL is required but the connection failed');
    return this.available;
  }

  async recoverRooms(): Promise<ManagedRoom[]> {
    if (!this.available) return [];
    try {
      const rows = await prisma.room.findMany({
        where: { status: { in: ['LOBBY', 'STARTING', 'IN_GAME'] } },
        include: {
          members: { where: { leftAt: null }, orderBy: { joinedAt: 'asc' } },
          games: {
            where: { status: { in: ['STARTING', 'ACTIVE', 'PAUSED'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              map: true,
              snapshots: { orderBy: { revision: 'desc' }, take: 10 },
              events: { orderBy: { sequence: 'desc' }, take: 10_000 }
            }
          }
        }
      });
      const recovered: ManagedRoom[] = [];
      for (const row of rows) {
        const members = new Map<string, ManagedMember>();
        for (const stored of row.members) {
          const customization = stored.customization as Record<string, unknown>;
          members.set(stored.playerId, {
            id: stored.id,
            userId: stored.userId,
            playerId: stored.playerId,
            nickname: stored.nickname,
            role: stored.role,
            ready: stored.ready,
            connected: false,
            isHost: stored.isHost,
            avatarId:
              typeof customization.avatarId === 'string' ? customization.avatarId : 'avatar-orbit',
            color: typeof customization.color === 'string' ? customization.color : '#8B5CF6',
            tokenId:
              typeof customization.tokenId === 'string' ? customization.tokenId : 'token-pulse',
            emoteId: typeof customization.emoteId === 'string' ? customization.emoteId : 'emote-gg',
            joinedAt: stored.joinedAt,
            socketIds: new Set()
          });
        }
        const host =
          [...members.values()].find((member) => member.isHost) ?? members.values().next().value;
        if (!host) continue;
        let managedGame: ManagedGame | null = null;
        const storedGame = row.games[0];
        if (storedGame?.map) {
          const map = storedGame.map.definition as unknown as MapConfig;
          const snapshot = storedGame.snapshots.find((candidate) => {
            if (stateChecksum(candidate.state) !== candidate.checksum) return false;
            try {
              deserializeGameState(JSON.stringify(candidate.state), map);
              return true;
            } catch {
              return false;
            }
          });
          if (!snapshot) {
            console.error(`[database] no valid snapshot found for game ${storedGame.id}`);
            continue;
          }
          let state = deserializeGameState(JSON.stringify(snapshot.state), map);
          let recoveredSequence = snapshot.eventSequence;
          const latestEvent = storedGame.events.find(
            (event) => event.sequence > snapshot.eventSequence
          );
          if (latestEvent) {
            const payload = latestEvent.payload as Record<string, unknown>;
            if (payload.resultingState) {
              try {
                state = deserializeGameState(JSON.stringify(payload.resultingState), map);
                recoveredSequence = latestEvent.sequence;
              } catch {
                console.error(
                  `[database] ignored invalid event state ${latestEvent.id} for game ${storedGame.id}`
                );
              }
            }
          }
          managedGame = {
            id: storedGame.id,
            state,
            map,
            eventSequence: recoveredSequence,
            persistedTransactionCount: state.transactions.length,
            handledActionIds: new Set(
              storedGame.events
                .map((event) => event.actionId)
                .filter((id): id is string => id !== null)
            )
          };
        }
        recovered.push({
          id: row.id,
          code: row.code,
          settings: row.settings as unknown as RoomSettings,
          passwordHash: row.passwordHash,
          status: row.status,
          version: row.version,
          hostPlayerId: host.playerId,
          members,
          game: managedGame,
          createdAt: row.createdAt,
          queue: new SerializedQueue()
        });
      }
      return recovered;
    } catch (error) {
      if (this.required) throw error;
      this.available = false;
      console.error('[database] persistence disabled after recovery failure', error);
      return [];
    }
  }

  private async safely(operation: () => Promise<void>): Promise<void> {
    if (!this.available) {
      if (this.required) throw new Error('Durable persistence is unavailable');
      return;
    }
    try {
      await operation();
    } catch (error) {
      if (this.required) throw error;
      this.available = false;
      console.error('[database] persistence disabled after write failure', error);
    }
  }

  async saveSession(session: ConnectedSession, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.safely(async () => {
      const username = `${session.nickname.slice(0, 15)}-${session.userId.slice(0, 6)}`;
      await prisma.user.upsert({
        where: { id: session.userId },
        update: { lastSeenAt: new Date() },
        create: {
          id: session.userId,
          username,
          isGuest: session.guest,
          profile: { create: { displayName: session.nickname } },
          statistics: { create: {} }
        }
      });
      await prisma.userSession.upsert({
        where: { tokenHash },
        update: { expiresAt, lastUsedAt: new Date(), revokedAt: null },
        create: { userId: session.userId, tokenHash, expiresAt }
      });
    });
  }

  async touchSession(userId: string, tokenHash: string): Promise<void> {
    await this.safely(async () => {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }),
        prisma.userSession.update({ where: { tokenHash }, data: { lastUsedAt: new Date() } })
      ]);
    });
  }

  async saveRoom(room: ManagedRoom): Promise<void> {
    await this.safely(async () => {
      const host = room.members.get(room.hostPlayerId);
      if (!host) return;
      await prisma.room.upsert({
        where: { id: room.id },
        update: {
          hostUserId: host.userId,
          name: room.settings.name,
          visibility: room.settings.visibility,
          status: room.status,
          passwordHash: room.passwordHash,
          maxPlayers: room.settings.maxPlayers,
          mapId: room.settings.mapId,
          mode: room.settings.mode,
          allowSpectators: room.settings.allowSpectators,
          settings: json(room.settings),
          version: room.version,
          lastActivityAt: new Date()
        },
        create: {
          id: room.id,
          code: room.code,
          name: room.settings.name,
          hostUserId: host.userId,
          visibility: room.settings.visibility,
          status: room.status,
          passwordHash: room.passwordHash,
          maxPlayers: room.settings.maxPlayers,
          mapId: room.settings.mapId,
          mode: room.settings.mode,
          allowSpectators: room.settings.allowSpectators,
          settings: json(room.settings),
          version: room.version
        }
      });
      for (const member of room.members.values()) {
        await prisma.roomMember.upsert({
          where: { roomId_playerId: { roomId: room.id, playerId: member.playerId } },
          update: {
            role: member.role,
            ready: member.ready,
            connected: member.connected,
            isHost: member.isHost,
            customization: json({
              avatarId: member.avatarId,
              color: member.color,
              tokenId: member.tokenId,
              emoteId: member.emoteId
            }),
            leftAt: null
          },
          create: {
            id: member.id,
            roomId: room.id,
            userId: member.userId,
            playerId: member.playerId,
            nickname: member.nickname,
            role: member.role,
            ready: member.ready,
            connected: member.connected,
            isHost: member.isHost,
            customization: json({
              avatarId: member.avatarId,
              color: member.color,
              tokenId: member.tokenId,
              emoteId: member.emoteId
            })
          }
        });
      }
    });
  }

  async markMemberLeft(roomId: string, playerId: string): Promise<void> {
    await this.safely(async () => {
      await prisma.roomMember.update({
        where: { roomId_playerId: { roomId, playerId } },
        data: { connected: false, leftAt: new Date(), isHost: false }
      });
    });
  }

  async createGame(room: ManagedRoom, map: MapConfig): Promise<void> {
    const game = room.game;
    if (!game) return;
    await this.safely(async () => {
      const gamePlayerIds = new Map(
        game.state.turnOrder.map((playerId) => [playerId, randomUUID()])
      );
      await prisma.$transaction(async (tx) => {
        await tx.mapDefinition.upsert({
          where: { id: map.id },
          update: { name: map.name, definition: json(map), active: true },
          create: { id: map.id, name: map.name, definition: json(map) }
        });
        await tx.game.create({
          data: {
            id: game.id,
            roomId: room.id,
            mapId: map.id,
            mode: room.settings.mode,
            status: 'ACTIVE',
            rules: json(game.state.rules),
            engineVersion: '0.1.0',
            currentRevision: game.state.revision,
            startedAt: new Date(game.state.updatedAt)
          }
        });
        await tx.gamePlayer.createMany({
          data: game.state.turnOrder.map((playerId, seat) => {
            const member = room.members.get(playerId);
            if (!member) throw new Error(`Missing room member ${playerId}`);
            return {
              id: gamePlayerIds.get(playerId)!,
              gameId: game.id,
              userId: member.userId,
              playerId,
              seat,
              nickname: member.nickname
            };
          })
        });
        await tx.transaction.createMany({
          data: game.state.transactions.map((transaction, index) => ({
            id: transaction.id,
            gameId: game.id,
            sequence: index + 1,
            fromGamePlayerId: transaction.fromPlayerId
              ? (gamePlayerIds.get(transaction.fromPlayerId) ?? null)
              : null,
            toGamePlayerId: transaction.toPlayerId
              ? (gamePlayerIds.get(transaction.toPlayerId) ?? null)
              : null,
            type: TRANSACTION_TYPES[transaction.type],
            amount: transaction.amount,
            ...(transaction.metadata ? { metadata: json(transaction.metadata) } : {}),
            createdAt: new Date(transaction.timestamp)
          }))
        });
        await tx.gameSnapshot.create({
          data: {
            gameId: game.id,
            revision: game.state.revision,
            eventSequence: 0,
            state: json(game.state),
            checksum: stateChecksum(game.state)
          }
        });
        await tx.room.update({
          where: { id: room.id },
          data: {
            status: room.status,
            version: room.version,
            lastActivityAt: new Date()
          }
        });
      });
    });
  }

  async appendAction(
    room: ManagedRoom,
    event: GameEventMessage,
    newTransactions: readonly EngineTransaction[]
  ): Promise<void> {
    const game = room.game;
    if (!game) throw new Error('Cannot persist an action without a game');
    await this.safely(async () => {
      const gamePlayers = await prisma.gamePlayer.findMany({
        where: { gameId: game.id },
        select: { id: true, playerId: true }
      });
      const playerRows = new Map(gamePlayers.map((row) => [row.playerId, row.id]));
      await prisma.$transaction(async (tx) => {
        await tx.gameEvent.create({
          data: {
            id: event.id,
            gameId: game.id,
            sequence: event.sequence,
            revision: game.state.revision,
            type: event.type,
            actorPlayerId: event.actorPlayerId,
            actionId: eventActionId(event),
            payload: json({ event: event.payload, resultingState: game.state })
          }
        });
        for (const transaction of newTransactions) {
          await tx.transaction.create({
            data: {
              id: transaction.id,
              gameId: game.id,
              sequence: game.persistedTransactionCount + newTransactions.indexOf(transaction) + 1,
              fromGamePlayerId: transaction.fromPlayerId
                ? (playerRows.get(transaction.fromPlayerId) ?? null)
                : null,
              toGamePlayerId: transaction.toPlayerId
                ? (playerRows.get(transaction.toPlayerId) ?? null)
                : null,
              type: TRANSACTION_TYPES[transaction.type],
              amount: transaction.amount,
              ...(transaction.metadata ? { metadata: json(transaction.metadata) } : {}),
              createdAt: new Date(transaction.timestamp)
            }
          });
        }
        await tx.game.update({
          where: { id: game.id },
          data: { currentRevision: game.state.revision }
        });
        if (event.sequence % this.snapshotEveryActions === 0 || game.state.phase === 'GAME_OVER') {
          await tx.gameSnapshot.upsert({
            where: { gameId_revision: { gameId: game.id, revision: game.state.revision } },
            update: {
              eventSequence: event.sequence,
              state: json(game.state),
              checksum: stateChecksum(game.state)
            },
            create: {
              gameId: game.id,
              revision: game.state.revision,
              eventSequence: event.sequence,
              state: json(game.state),
              checksum: stateChecksum(game.state)
            }
          });
        }
        if (game.state.phase === 'GAME_OVER') {
          const recap = buildMatchRecap(room);
          const winnerIds = new Set(game.state.winnerIds);
          await tx.matchResult.create({
            data: {
              gameId: game.id,
              winnerPlayerId: game.state.winnerIds[0] ?? null,
              victoryReason: game.state.rules.victoryMode,
              durationMs: recap.durationMs,
              roundsPlayed: recap.roundsPlayed,
              recap: json(recap),
              players: {
                create: recap.players.map((player) => ({
                  gamePlayerId: playerRows.get(player.playerId) as string,
                  placement: player.placement,
                  cash: player.finalCash,
                  netWorth: player.netWorth,
                  rentEarned: player.rentEarned,
                  propertiesOwned: player.propertiesOwned,
                  propertiesPurchased: player.propertiesPurchased,
                  tradesCompleted: player.tradesCompleted,
                  biggestTransaction: Math.max(
                    player.biggestPaymentMade,
                    player.biggestPaymentReceived
                  )
                }))
              }
            }
          });
          await tx.game.update({
            where: { id: game.id },
            data: { status: 'FINISHED', finishedAt: new Date(game.state.updatedAt) }
          });
          for (const player of recap.players) {
            const storedPlayer = gamePlayers.find((item) => item.playerId === player.playerId);
            if (!storedPlayer) continue;
            await tx.gamePlayer.update({
              where: { id: storedPlayer.id },
              data: {
                status: player.status,
                placement: player.placement,
                finalCash: player.finalCash,
                finalNetWorth: player.netWorth
              }
            });
            const member = room.members.get(player.playerId);
            if (!member) continue;
            const won = winnerIds.has(player.playerId);
            await tx.userStatistics.upsert({
              where: { userId: member.userId },
              create: {
                userId: member.userId,
                gamesPlayed: 1,
                wins: won ? 1 : 0,
                losses: won ? 0 : 1,
                totalMoneyEarned: player.moneyEarned,
                biggestFortune: player.netWorth,
                propertiesPurchased: player.propertiesPurchased,
                bankruptcies: player.status === 'BANKRUPT' ? 1 : 0,
                tradesCompleted: player.tradesCompleted,
                rentCollected: player.rentEarned,
                currentWinStreak: won ? 1 : 0,
                bestWinStreak: won ? 1 : 0
              },
              update: {
                gamesPlayed: { increment: 1 },
                wins: { increment: won ? 1 : 0 },
                losses: { increment: won ? 0 : 1 },
                totalMoneyEarned: { increment: player.moneyEarned },
                propertiesPurchased: { increment: player.propertiesPurchased },
                bankruptcies: { increment: player.status === 'BANKRUPT' ? 1 : 0 },
                tradesCompleted: { increment: player.tradesCompleted },
                rentCollected: { increment: player.rentEarned },
                currentWinStreak: won ? { increment: 1 } : 0
              }
            });
          }
        }
      });
    });
  }
}
