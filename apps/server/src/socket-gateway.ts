import { createHash, randomUUID } from 'node:crypto';

import type {
  Ack,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SessionReadyPayload,
  SocketData
} from '@circuit/shared';
import {
  chatMessageSchema,
  createRoomSchema,
  createSessionSchema,
  emoteSchema,
  gameActionSchema,
  joinRoomSchema,
  kickPlayerSchema,
  leaveRoomSchema,
  listRoomsSchema,
  pingSchema,
  quickPlaySchema,
  readySchema,
  rematchSchema,
  resumeSessionSchema,
  startGameSchema,
  transferHostSchema,
  updatePlayerSchema,
  updateSettingsSchema
} from '@circuit/shared';
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { z } from 'zod';

import type { ServerConfig } from './config.js';
import type { ConnectedSession } from './domain.js';
import { RequestError, toApiError } from './errors.js';
import type { RoomManager } from './room-manager.js';
import { SlidingWindowRateLimiter } from './rate-limit.js';
import { issueReconnectToken, verifyReconnectToken } from './security.js';

type CircuitServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type CircuitSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

function success<T>(data: T): Ack<T> {
  return { ok: true, data } as Ack<T>;
}

function successVoid(): Ack {
  return { ok: true };
}

async function execute<T, R>(
  schema: z.ZodType<T>,
  payload: unknown,
  ack: (value: Ack<R>) => void,
  operation: (input: T) => Promise<R> | R
): Promise<void> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    ack({ ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid request payload' } });
    return;
  }
  try {
    ack(success(await operation(parsed.data)));
  } catch (error) {
    if (!(error instanceof RequestError)) console.error('[socket] operation failed', error);
    ack({ ok: false, error: toApiError(error) });
  }
}

function requireSession(socket: CircuitSocket): ConnectedSession {
  if (!socket.data.userId || !socket.data.playerId || socket.data.guest === undefined) {
    throw new RequestError('UNAUTHORIZED', 'Create or resume a session first');
  }
  return {
    userId: socket.data.userId,
    playerId: socket.data.playerId,
    nickname: String(socket.handshake.auth.nickname ?? ''),
    guest: socket.data.guest
  };
}

function setSession(socket: CircuitSocket, session: ConnectedSession): void {
  socket.data.userId = session.userId;
  socket.data.playerId = session.playerId;
  socket.data.guest = session.guest;
  socket.handshake.auth.nickname = session.nickname;
}

export function createSocketServer(
  httpServer: HttpServer,
  manager: RoomManager,
  config: ServerConfig
): CircuitServer {
  const sessionLimiter = new SlidingWindowRateLimiter(8, 60_000);
  const roomMutationLimiter = new SlidingWindowRateLimiter(24, 60_000);
  const roomListLimiter = new SlidingWindowRateLimiter(90, 60_000);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins,
        credentials: true
      },
      maxHttpBufferSize: 32 * 1024,
      pingInterval: 20_000,
      pingTimeout: 15_000,
      transports: ['websocket', 'polling'],
      connectionStateRecovery: {
        maxDisconnectionDuration: config.disconnectGraceMs,
        skipMiddlewares: false
      }
    }
  );

  manager.on('roomState', (room) => io.to(room.id).emit('room:state', room));
  manager.on('roomsChanged', () => io.emit('rooms:changed'));
  manager.on('connectivity', (payload) =>
    io.to(payload.roomId).emit('player:connectivity', payload)
  );
  manager.on('hostChanged', (payload) => io.to(payload.roomId).emit('host:changed', payload));
  manager.on('gameStarted', ({ roomId, state }) => io.to(roomId).emit('game:started', state));
  manager.on('gameState', ({ roomId, state }) => io.to(roomId).emit('game:state', state));
  manager.on('gameEvent', ({ roomId, event }) => io.to(roomId).emit('game:event', event));
  manager.on('chatMessage', ({ roomId, message }) => io.to(roomId).emit('chat:message', message));

  io.on('connection', (socket) => {
    const clientKey = socket.handshake.address || socket.id;
    const enforceLimit = (limiter: SlidingWindowRateLimiter): void => {
      if (!limiter.consume(clientKey))
        throw new RequestError('RATE_LIMITED', 'Too many requests. Please wait a moment.');
    };

    socket.on('session:create', (payload, ack) => {
      void execute(createSessionSchema, payload, ack, async ({ nickname }) => {
        enforceLimit(sessionLimiter);
        if (socket.data.playerId)
          throw new RequestError('CONFLICT', 'Socket already has a session');
        const session: ConnectedSession = {
          userId: randomUUID(),
          playerId: randomUUID(),
          nickname,
          guest: true
        };
        setSession(socket, session);
        const reconnectToken = issueReconnectToken(
          session,
          config.sessionSecret,
          config.reconnectTtlMs
        );
        await manager.persistence.saveSession(
          session,
          createHash('sha256').update(reconnectToken).digest('hex'),
          new Date(Date.now() + config.reconnectTtlMs)
        );
        return {
          identity: session,
          reconnectToken,
          resumed: false,
          room: null
        } satisfies SessionReadyPayload;
      });
    });

    socket.on('session:resume', (payload, ack) => {
      void execute(resumeSessionSchema, payload, ack, async ({ reconnectToken }) => {
        enforceLimit(sessionLimiter);
        const claims = verifyReconnectToken(reconnectToken, config.sessionSecret);
        if (!claims)
          throw new RequestError('UNAUTHORIZED', 'Reconnect token is invalid or expired');
        const session: ConnectedSession = {
          userId: claims.userId,
          playerId: claims.playerId,
          nickname: claims.nickname,
          guest: claims.guest
        };
        setSession(socket, session);
        const room = await manager.reconnect(session, socket.id);
        if (room) {
          await socket.join(room.id);
          socket.data.roomId = room.id;
          const gameState = manager.getGameState(room.id);
          if (gameState) socket.emit('game:state', gameState);
        }
        await manager.persistence.saveSession(
          session,
          createHash('sha256').update(reconnectToken).digest('hex'),
          new Date(claims.expiresAt)
        );
        return {
          identity: session,
          reconnectToken,
          resumed: true,
          room
        } satisfies SessionReadyPayload;
      });
    });

    socket.on('rooms:list', (payload, ack) => {
      void execute(listRoomsSchema, payload, ack, (input) => {
        enforceLimit(roomListLimiter);
        return manager.listRooms(input);
      });
    });

    socket.on('room:create', (payload, ack) => {
      void execute(createRoomSchema, payload, ack, async (input) => {
        enforceLimit(roomMutationLimiter);
        const session = requireSession(socket);
        const room = await manager.createRoom(session, input, socket.id);
        await socket.join(room.id);
        socket.data.roomId = room.id;
        return room;
      });
    });

    socket.on('room:join', (payload, ack) => {
      void execute(joinRoomSchema, payload, ack, async (input) => {
        enforceLimit(roomMutationLimiter);
        const session = requireSession(socket);
        const room = await manager.joinRoom(session, input, socket.id);
        await socket.join(room.id);
        socket.data.roomId = room.id;
        socket.to(room.id).emit('player:joined', {
          roomId: room.id,
          playerId: session.playerId,
          nickname: session.nickname
        });
        return room;
      });
    });

    socket.on('room:quickPlay', (payload, ack) => {
      void execute(quickPlaySchema, payload, ack, async (input) => {
        enforceLimit(roomMutationLimiter);
        const session = requireSession(socket);
        const room = await manager.quickPlay(session, input, socket.id);
        await socket.join(room.id);
        socket.data.roomId = room.id;
        return room;
      });
    });

    socket.on('room:leave', (payload, ack) => {
      const parsed = leaveRoomSchema.safeParse(payload);
      if (!parsed.success)
        return ack({
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid request payload' }
        });
      const session = requireSession(socket);
      if (socket.data.roomId !== parsed.data.roomId)
        return ack({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Player does not belong to that room' }
        });
      void manager
        .leaveRoom(session)
        .then(async () => {
          await socket.leave(parsed.data.roomId);
          delete socket.data.roomId;
          socket.to(parsed.data.roomId).emit('player:left', {
            roomId: parsed.data.roomId,
            playerId: session.playerId,
            nickname: session.nickname
          });
          ack(successVoid());
        })
        .catch((error: unknown) => ack({ ok: false, error: toApiError(error) }));
    });

    socket.on('lobby:setReady', (payload, ack) => {
      void execute(readySchema, payload, ack, (input) => {
        const session = requireSession(socket);
        if (input.roomId !== socket.data.roomId)
          throw new RequestError('FORBIDDEN', 'Invalid room');
        return manager.setReady(session.playerId, input.ready);
      });
    });

    socket.on('lobby:updatePlayer', (payload, ack) => {
      void execute(updatePlayerSchema, payload, ack, (input) => {
        const session = requireSession(socket);
        if (input.roomId !== socket.data.roomId)
          throw new RequestError('FORBIDDEN', 'Invalid room');
        return manager.updatePlayer(session.playerId, input.customization);
      });
    });

    socket.on('lobby:updateSettings', (payload, ack) => {
      void execute(updateSettingsSchema, payload, ack, (input) => {
        const session = requireSession(socket);
        if (input.roomId !== socket.data.roomId)
          throw new RequestError('FORBIDDEN', 'Invalid room');
        return manager.updateSettings(session.playerId, input.settings);
      });
    });

    socket.on('lobby:start', (payload, ack) => {
      void execute(startGameSchema, payload, ack, (input) => {
        const session = requireSession(socket);
        if (input.roomId !== socket.data.roomId)
          throw new RequestError('FORBIDDEN', 'Invalid room');
        return manager.startGame(session.playerId);
      });
    });

    socket.on('lobby:rematch', (payload, ack) => {
      void execute(rematchSchema, payload, ack, (input) => {
        const session = requireSession(socket);
        if (input.roomId !== socket.data.roomId)
          throw new RequestError('FORBIDDEN', 'Invalid room');
        return manager.rematch(session.playerId, input.roomId);
      });
    });

    socket.on('lobby:kick', (payload, ack) => {
      const parsed = kickPlayerSchema.safeParse(payload);
      if (!parsed.success)
        return ack({
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid request payload' }
        });
      try {
        const session = requireSession(socket);
        if (parsed.data.roomId !== socket.data.roomId)
          throw new RequestError('FORBIDDEN', 'Invalid room');
        void manager
          .kick(session.playerId, parsed.data.playerId)
          .then(async () => {
            const targets = await io.in(parsed.data.roomId).fetchSockets();
            for (const target of targets) {
              if (target.data.playerId === parsed.data.playerId) {
                target.emit('room:kicked', {
                  roomId: parsed.data.roomId,
                  reason: 'Removed by host'
                });
                delete target.data.roomId;
                target.leave(parsed.data.roomId);
              }
            }
            ack(successVoid());
          })
          .catch((error: unknown) => ack({ ok: false, error: toApiError(error) }));
      } catch (error) {
        ack({ ok: false, error: toApiError(error) });
      }
    });

    socket.on('lobby:transferHost', (payload, ack) => {
      void execute(transferHostSchema, payload, ack, (input) => {
        const session = requireSession(socket);
        if (input.roomId !== socket.data.roomId)
          throw new RequestError('FORBIDDEN', 'Invalid room');
        return manager.transferHost(session.playerId, input.playerId);
      });
    });

    socket.on('game:action', (payload, ack) => {
      void execute(gameActionSchema, payload, ack, (input) => {
        const session = requireSession(socket);
        return manager.applyAction(session.playerId, input);
      });
    });

    socket.on('chat:send', (payload, ack) => {
      void execute(chatMessageSchema, payload, ack, (input) => {
        const session = requireSession(socket);
        return manager.sendChat(session.playerId, input.roomId, input.text);
      });
    });

    socket.on('player:emote', (payload, ack) => {
      const parsed = emoteSchema.safeParse(payload);
      if (!parsed.success)
        return ack({
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid request payload' }
        });
      try {
        const session = requireSession(socket);
        if (parsed.data.roomId !== socket.data.roomId)
          throw new RequestError('FORBIDDEN', 'Invalid room');
        io.to(parsed.data.roomId).emit('emote:shown', {
          roomId: parsed.data.roomId,
          playerId: session.playerId,
          emoteId: parsed.data.emoteId,
          expiresAt: new Date(Date.now() + 3_000).toISOString()
        });
        ack(successVoid());
      } catch (error) {
        ack({ ok: false, error: toApiError(error) });
      }
    });

    socket.on('ping', (payload, ack) => {
      void execute(pingSchema, payload, ack, ({ sentAt }) => ({ sentAt, serverTime: Date.now() }));
    });

    socket.on('disconnect', () => {
      if (socket.data.playerId) manager.disconnect(socket.data.playerId, socket.id);
    });
  });

  return io;
}
