import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { resolve } from 'node:path';
import { disconnectDatabase } from '@circuit/database';
import { idSchema } from '@circuit/shared';

import { loadServerConfig, type ServerConfig } from './config.js';
import { PersistenceService } from './persistence.js';
import { RoomManager } from './room-manager.js';
import { createSocketServer } from './socket-gateway.js';
import { verifyReconnectToken } from './security.js';

export interface CircuitServer {
  app: FastifyInstance;
  io: ReturnType<typeof createSocketServer>;
  manager: RoomManager;
  config: ServerConfig;
  close: () => Promise<void>;
}

export async function buildServer(overrides: Partial<ServerConfig> = {}): Promise<CircuitServer> {
  const config = loadServerConfig(overrides);
  const app = Fastify({
    logger: config.logLevel === 'silent' ? false : { level: config.logLevel }
  });
  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      callback(
        null,
        !origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)
      );
    }
  });
  app.addHook('onSend', async (_request, reply, payload) => {
    void reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('X-Frame-Options', 'DENY')
      .header('Referrer-Policy', 'strict-origin-when-cross-origin')
      .header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return payload;
  });

  const persistence = new PersistenceService(
    config.databaseEnabled,
    config.snapshotEveryActions,
    config.databaseRequired
  );
  const manager = new RoomManager(persistence, config);
  await manager.initialize();
  const io = createSocketServer(app.server, manager, config);

  const live = () => ({ status: 'ok', timestamp: new Date().toISOString() });
  app.get('/health', live);
  app.get('/health/live', live);

  const ready = async (_request: FastifyRequest, reply: FastifyReply) => {
    const database = await persistence.isReady();
    if (!database) reply.code(503);
    return {
      status: database ? 'ready' : 'not_ready',
      database: database
        ? persistence.databaseAvailable
          ? 'connected'
          : 'disabled'
        : 'unavailable',
      timestamp: new Date().toISOString()
    };
  };
  app.get('/ready', ready);
  app.get('/health/ready', ready);

  app.get<{ Params: { gameId: string } }>('/matches/:gameId', async (request, reply) => {
    const parsed = idSchema.safeParse(request.params.gameId);
    if (!parsed.success) return reply.code(404).send({ error: 'Match not found' });
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    const claims = token ? verifyReconnectToken(token, config.sessionSecret) : null;
    const recap = await persistence.getMatchRecap(parsed.data, claims?.playerId);
    if (!recap) return reply.code(404).send({ error: 'Match not found' });
    return reply.send(recap);
  });

  if (config.serveWeb) {
    await app.register(fastifyStatic, {
      root: resolve(process.cwd(), config.webDistPath),
      prefix: '/'
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && request.headers.accept?.includes('text/html'))
        return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'Not found' });
    });
  }

  return {
    app,
    io,
    manager,
    config,
    close: async () => {
      manager.close();
      await new Promise<void>((resolve) => {
        void io.close(() => resolve());
      });
      await app.close();
      await disconnectDatabase();
    }
  };
}
