import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import type {
  Ack,
  AuthoritativeGameState,
  ClientToServerEvents,
  PublicRoomState,
  ServerToClientEvents,
  SessionReadyPayload
} from '@circuit/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildServer, type CircuitServer } from '../src/app.js';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SETTINGS = {
  name: 'Authoritative Match',
  visibility: 'PUBLIC' as const,
  maxPlayers: 4,
  mapId: 'neon-city',
  mode: 'CLASSIC' as const,
  allowSpectators: true,
  rules: {
    startingCash: 3_200,
    turnTimerSeconds: 45 as const,
    victoryMode: 'LAST_PLAYER_STANDING' as const,
    maxRounds: 30,
    netWorthTarget: null,
    auctionsEnabled: true,
    tradesEnabled: true,
    economicEventsEnabled: true,
    doublesExtraRoll: true
  }
};

function connectClient(url: string): Promise<TestSocket> {
  const socket: TestSocket = connect(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function createSession(socket: TestSocket, nickname: string): Promise<Ack<SessionReadyPayload>> {
  return new Promise((resolve) => socket.emit('session:create', { nickname }, resolve));
}

function waitForEvent<T>(
  socket: TestSocket,
  event: Extract<keyof ServerToClientEvents, string>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 2_000);
    socket.once(event, ((payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    }) as never);
  });
}

describe('authoritative realtime server', () => {
  let server: CircuitServer;
  let url: string;
  const sockets: TestSocket[] = [];

  beforeEach(async () => {
    server = await buildServer({
      host: '127.0.0.1',
      port: 0,
      databaseEnabled: false,
      disconnectGraceMs: 120,
      logLevel: 'silent',
      sessionSecret: 'integration-test-secret-with-at-least-32-chars'
    });
    await server.app.listen({ host: '127.0.0.1', port: 0 });
    const address = server.app.server.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const socket of sockets) socket.disconnect();
    await server.close();
  });

  it('separates liveness from database readiness', async () => {
    const health = await server.app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ status: 'ok' });
    expect(health.json()).not.toHaveProperty('database');

    const ready = await server.app.inject({ method: 'GET', url: '/ready' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({ status: 'ready', database: 'disabled' });
  });

  it('synchronizes a game action and restores a disconnected player session', async () => {
    const host = await connectClient(url);
    const guest = await connectClient(url);
    sockets.push(host, guest);
    const hostSession = await createSession(host, 'Host Player');
    const guestSession = await createSession(guest, 'Guest Player');
    expect(hostSession.ok && guestSession.ok).toBe(true);
    if (!hostSession.ok || !guestSession.ok) throw new Error('Session setup failed');

    const created = await new Promise<Ack<PublicRoomState>>((resolve) => {
      host.emit('room:create', { settings: SETTINGS }, resolve);
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(created.error.message);
    const joined = await new Promise<Ack<PublicRoomState>>((resolve) => {
      guest.emit('room:join', { code: created.data.code, asSpectator: false }, resolve);
    });
    expect(joined).toMatchObject({ ok: true, data: { playerCount: 2 } });

    await Promise.all(
      [host, guest].map(
        (socket) =>
          new Promise<Ack<PublicRoomState>>((resolve) => {
            socket.emit('lobby:setReady', { roomId: created.data.id, ready: true }, resolve);
          })
      )
    );
    const guestStarted = waitForEvent<AuthoritativeGameState>(guest, 'game:started');
    const started = await new Promise<Ack<AuthoritativeGameState>>((resolve) => {
      host.emit('lobby:start', { roomId: created.data.id }, resolve);
    });
    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error(started.error.message);
    expect((await guestStarted).gameId).toBe(started.data.gameId);

    const guestState = waitForEvent<AuthoritativeGameState>(guest, 'game:state');
    const rolled = await new Promise<Ack<AuthoritativeGameState>>((resolve) => {
      host.emit(
        'game:action',
        {
          roomId: created.data.id,
          action: {
            actionId: randomUUID(),
            expectedVersion: started.data.version,
            type: 'ROLL_DICE'
          }
        },
        resolve
      );
    });
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) throw new Error(rolled.error.message);
    expect((await guestState).state).toEqual(rolled.data.state);

    guest.disconnect();
    const resumedSocket = await connectClient(url);
    sockets.push(resumedSocket);
    const resumed = await new Promise<Ack<SessionReadyPayload>>((resolve) => {
      resumedSocket.emit(
        'session:resume',
        { reconnectToken: guestSession.data.reconnectToken },
        resolve
      );
    });
    expect(resumed).toMatchObject({ ok: true, data: { resumed: true } });
    if (!resumed.ok) throw new Error(resumed.error.message);
    expect(resumed.data.room?.id).toBe(created.data.id);
  });

  it('lets the host transfer lobby ownership safely', async () => {
    const host = await connectClient(url);
    const guest = await connectClient(url);
    sockets.push(host, guest);
    const hostSession = await createSession(host, 'First Host');
    const guestSession = await createSession(guest, 'Next Host');
    if (!hostSession.ok || !guestSession.ok) throw new Error('Session setup failed');
    const created = await new Promise<Ack<PublicRoomState>>((resolve) => {
      host.emit('room:create', { settings: SETTINGS }, resolve);
    });
    if (!created.ok) throw new Error(created.error.message);
    await new Promise<Ack<PublicRoomState>>((resolve) => {
      guest.emit('room:join', { code: created.data.code, asSpectator: false }, resolve);
    });
    const transferred = await new Promise<Ack<PublicRoomState>>((resolve) => {
      host.emit(
        'lobby:transferHost',
        { roomId: created.data.id, playerId: guestSession.data.identity.playerId },
        resolve
      );
    });
    expect(transferred).toMatchObject({
      ok: true,
      data: { hostPlayerId: guestSession.data.identity.playerId }
    });
  });

  it('acknowledges a duplicate lobby request with a useful conflict', async () => {
    const host = await connectClient(url);
    sockets.push(host);
    const session = await createSession(host, 'Lobby Owner');
    expect(session.ok).toBe(true);

    const created = await new Promise<Ack<PublicRoomState>>((resolve) => {
      host.emit('room:create', { settings: SETTINGS }, resolve);
    });
    expect(created.ok).toBe(true);

    const duplicate = await new Promise<Ack<PublicRoomState>>((resolve) => {
      host.emit('room:create', { settings: SETTINGS }, resolve);
    });
    expect(duplicate).toMatchObject({
      ok: false,
      error: {
        code: 'CONFLICT',
        message: 'Leave the current lobby before creating another.'
      }
    });
  });

  it('replaces an active game with a new lobby and forfeits the departing player', async () => {
    const host = await connectClient(url);
    const guest = await connectClient(url);
    sockets.push(host, guest);
    const hostSession = await createSession(host, 'Replacing Host');
    const guestSession = await createSession(guest, 'Remaining Guest');
    if (!hostSession.ok || !guestSession.ok) throw new Error('Session setup failed');

    const created = await new Promise<Ack<PublicRoomState>>((resolve) => {
      host.emit('room:create', { settings: SETTINGS }, resolve);
    });
    if (!created.ok) throw new Error(created.error.message);
    const joined = await new Promise<Ack<PublicRoomState>>((resolve) => {
      guest.emit('room:join', { code: created.data.code, asSpectator: false }, resolve);
    });
    expect(joined.ok).toBe(true);
    await Promise.all(
      [host, guest].map(
        (socket) =>
          new Promise<Ack<PublicRoomState>>((resolve) => {
            socket.emit('lobby:setReady', { roomId: created.data.id, ready: true }, resolve);
          })
      )
    );
    const started = await new Promise<Ack<AuthoritativeGameState>>((resolve) => {
      host.emit('lobby:start', { roomId: created.data.id }, resolve);
    });
    expect(started.ok).toBe(true);

    const guestFinalState = waitForEvent<AuthoritativeGameState>(guest, 'game:state');
    const replacement = await new Promise<Ack<PublicRoomState>>((resolve) => {
      host.emit(
        'room:create',
        {
          settings: { ...SETTINGS, name: 'Replacement Lobby' },
          replaceExisting: true
        },
        resolve
      );
    });
    expect(replacement).toMatchObject({
      ok: true,
      data: { name: 'Replacement Lobby', status: 'LOBBY', playerCount: 1 }
    });
    if (!replacement.ok) throw new Error(replacement.error.message);
    expect(replacement.data.id).not.toBe(created.data.id);
    const finalState = await guestFinalState;
    expect(finalState.state).toMatchObject({
      phase: 'GAME_OVER',
      winnerIds: [guestSession.data.identity.playerId]
    });
  });

  it('can replace one lobby by joining another without a stale membership conflict', async () => {
    const first = await connectClient(url);
    const second = await connectClient(url);
    sockets.push(first, second);
    const firstSession = await createSession(first, 'First Lobby');
    const secondSession = await createSession(second, 'Second Lobby');
    if (!firstSession.ok || !secondSession.ok) throw new Error('Session setup failed');

    const firstRoom = await new Promise<Ack<PublicRoomState>>((resolve) => {
      first.emit('room:create', { settings: SETTINGS }, resolve);
    });
    const secondRoom = await new Promise<Ack<PublicRoomState>>((resolve) => {
      second.emit('room:create', { settings: { ...SETTINGS, name: 'Join Target' } }, resolve);
    });
    if (!firstRoom.ok || !secondRoom.ok) throw new Error('Lobby setup failed');

    const joined = await new Promise<Ack<PublicRoomState>>((resolve) => {
      first.emit(
        'room:join',
        { code: secondRoom.data.code, asSpectator: false, replaceExisting: true },
        resolve
      );
    });
    expect(joined).toMatchObject({
      ok: true,
      data: { id: secondRoom.data.id, playerCount: 2 }
    });
  });

  it('can replace a private lobby through quick play', async () => {
    const player = await connectClient(url);
    sockets.push(player);
    const session = await createSession(player, 'Quick Player');
    if (!session.ok) throw new Error('Session setup failed');
    const privateRoom = await new Promise<Ack<PublicRoomState>>((resolve) => {
      player.emit(
        'room:create',
        { settings: { ...SETTINGS, visibility: 'PRIVATE', name: 'Old Private Lobby' } },
        resolve
      );
    });
    if (!privateRoom.ok) throw new Error(privateRoom.error.message);

    const quickRoom = await new Promise<Ack<PublicRoomState>>((resolve) => {
      player.emit(
        'room:quickPlay',
        { mode: 'CLASSIC', mapId: 'neon-city', maxPlayers: 4, replaceExisting: true },
        resolve
      );
    });
    expect(quickRoom).toMatchObject({
      ok: true,
      data: { status: 'LOBBY', visibility: 'PUBLIC', playerCount: 1 }
    });
    if (!quickRoom.ok) throw new Error(quickRoom.error.message);
    expect(quickRoom.data.id).not.toBe(privateRoom.data.id);
  });

  it('starts an eight-player room without divergent membership', async () => {
    const clients = await Promise.all(Array.from({ length: 8 }, () => connectClient(url)));
    sockets.push(...clients);
    const sessions = await Promise.all(
      clients.map((client, index) => createSession(client, `Load Player ${index + 1}`))
    );
    expect(sessions.every((session) => session.ok)).toBe(true);
    const created = await new Promise<Ack<PublicRoomState>>((resolve) => {
      clients[0]!.emit('room:create', { settings: { ...SETTINGS, maxPlayers: 8 } }, resolve);
    });
    if (!created.ok) throw new Error(created.error.message);
    const joins = await Promise.all(
      clients.slice(1).map(
        (client) =>
          new Promise<Ack<PublicRoomState>>((resolve) => {
            client.emit('room:join', { code: created.data.code, asSpectator: false }, resolve);
          })
      )
    );
    expect(joins.every((join) => join.ok)).toBe(true);
    expect(joins.at(-1)).toMatchObject({ ok: true, data: { playerCount: 8 } });
    await Promise.all(
      clients.map(
        (client) =>
          new Promise<Ack<PublicRoomState>>((resolve) => {
            client.emit('lobby:setReady', { roomId: created.data.id, ready: true }, resolve);
          })
      )
    );
    const started = await new Promise<Ack<AuthoritativeGameState>>((resolve) => {
      clients[0]!.emit('lobby:start', { roomId: created.data.id }, resolve);
    });
    expect(started).toMatchObject({
      ok: true,
      data: { state: { turnOrder: { length: 8 } } }
    });
  });
});
