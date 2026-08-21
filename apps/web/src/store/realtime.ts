import type {
  AuthoritativeGameState,
  ChatMessage,
  GameEventMessage,
  JsonValue,
  PublicRoomState,
  PublicRoomSummary,
  RoomSettings,
  SessionIdentity,
  SessionReadyPayload
} from '@circuit/shared';
import { create } from 'zustand';

import { loadStoredSession, saveStoredSession } from '../lib/session-storage';
import { getSupportedMapIds } from '../lib/server-capabilities';
import { createClientId } from '../lib/client-id';
import { socket } from '../lib/socket';

interface RealtimeState {
  connected: boolean;
  sessionPending: boolean;
  identity: SessionIdentity | null;
  reconnectToken: string | null;
  room: PublicRoomState | null;
  rooms: PublicRoomSummary[];
  game: AuthoritativeGameState | null;
  chat: ChatMessage[];
  events: GameEventMessage[];
  error: string | null;
  createSession: (nickname: string) => Promise<SessionReadyPayload>;
  listRooms: () => Promise<PublicRoomSummary[]>;
  createRoom: (settings: RoomSettings, password?: string) => Promise<PublicRoomState>;
  joinRoom: (code: string, password?: string) => Promise<PublicRoomState>;
  quickPlay: () => Promise<PublicRoomState>;
  leaveRoom: () => Promise<void>;
  setReady: (ready: boolean) => Promise<PublicRoomState>;
  startGame: () => Promise<AuthoritativeGameState>;
  rematch: () => Promise<PublicRoomState>;
  kickPlayer: (playerId: string) => Promise<void>;
  transferHost: (playerId: string) => Promise<PublicRoomState>;
  sendChat: (text: string) => Promise<ChatMessage>;
  sendGameAction: (type: string, payload?: JsonValue) => Promise<AuthoritativeGameState>;
  clearError: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The server rejected the request.';
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  connected: socket.connected,
  sessionPending: false,
  identity: null,
  reconnectToken: null,
  room: null,
  rooms: [],
  game: null,
  chat: [],
  events: [],
  error: null,

  createSession: async (nickname) => {
    set({ sessionPending: true, error: null });
    const response = await new Promise<SessionReadyPayload>((resolve, reject) => {
      socket.emit('session:create', { nickname }, (ack) => {
        if (ack.ok) resolve(ack.data);
        else reject(new Error(ack.error.message));
      });
    }).catch((error: unknown) => {
      set({ error: errorMessage(error), sessionPending: false });
      throw error;
    });
    saveStoredSession({
      reconnectToken: response.reconnectToken,
      nickname: response.identity.nickname
    });
    set({
      identity: response.identity,
      reconnectToken: response.reconnectToken,
      room: response.room,
      sessionPending: false
    });
    return response;
  },

  listRooms: async () => {
    const rooms = await new Promise<PublicRoomSummary[]>((resolve, reject) => {
      socket.emit('rooms:list', { onlyJoinable: true, limit: 50 }, (ack) => {
        if (ack.ok) resolve(ack.data);
        else reject(new Error(ack.error.message));
      });
    });
    set({ rooms });
    return rooms;
  },

  createRoom: async (settings, password) => {
    set({ error: null });
    const room = await requestWithAck<PublicRoomState>('crear la sala', (ack) =>
      socket.emit(
        'room:create',
        { settings, replaceExisting: true, ...(password ? { password } : {}) },
        ack
      )
    ).catch((error: unknown) => {
      set({ error: errorMessage(error) });
      throw error;
    });
    set({ room, game: null, chat: [], events: [] });
    return room;
  },

  joinRoom: async (code, password) => {
    set({ error: null });
    const room = await requestWithAck<PublicRoomState>('unirse a la sala', (ack) => {
      socket.emit(
        'room:join',
        {
          code: code.toUpperCase(),
          asSpectator: false,
          replaceExisting: true,
          ...(password ? { password } : {})
        },
        ack
      );
    }).catch((error: unknown) => {
      set({ error: errorMessage(error) });
      throw error;
    });
    set({ room, game: null, chat: [], events: [] });
    return room;
  },

  quickPlay: async () => {
    set({ error: null });
    const supportedMapIds = await getSupportedMapIds();
    const preferredMapId = supportedMapIds.includes('world-capital-routes')
      ? 'world-capital-routes'
      : 'neon-city';
    const requestQuickPlay = (mapId: string) =>
      requestWithAck<PublicRoomState>('buscar una partida rápida', (ack) => {
        socket.emit(
          'room:quickPlay',
          { mode: 'CLASSIC', mapId, maxPlayers: 4, replaceExisting: true },
          ack
        );
      });
    let room: PublicRoomState;
    try {
      room = await requestQuickPlay(preferredMapId);
    } catch (error) {
      const unsupportedMap =
        error instanceof Error && error.message.includes('Map is not available on this server');
      if (!unsupportedMap) {
        set({ error: errorMessage(error) });
        throw error;
      }
      room = await requestQuickPlay('neon-city').catch((fallbackError: unknown) => {
        set({ error: errorMessage(fallbackError) });
        throw fallbackError;
      });
    }
    set({ room, game: null, chat: [], events: [] });
    return room;
  },

  leaveRoom: async () => {
    const room = get().room;
    if (!room) return;
    await new Promise<void>((resolve, reject) => {
      socket.emit('room:leave', { roomId: room.id }, (ack) => {
        if (ack.ok) resolve();
        else reject(new Error(ack.error.message));
      });
    });
    set({ room: null, game: null, chat: [], events: [] });
  },

  setReady: async (ready) => {
    const room = get().room;
    if (!room) throw new Error('Join a room first.');
    const next = await new Promise<PublicRoomState>((resolve, reject) => {
      socket.emit('lobby:setReady', { roomId: room.id, ready }, (ack) => {
        if (ack.ok) resolve(ack.data);
        else reject(new Error(ack.error.message));
      });
    });
    set({ room: next });
    return next;
  },

  startGame: async () => {
    const room = get().room;
    if (!room) throw new Error('Join a room first.');
    const game = await new Promise<AuthoritativeGameState>((resolve, reject) => {
      socket.emit('lobby:start', { roomId: room.id }, (ack) => {
        if (ack.ok) resolve(ack.data);
        else reject(new Error(ack.error.message));
      });
    });
    set({ game });
    return game;
  },

  rematch: async () => {
    const room = get().room;
    if (!room) throw new Error('Join a room first.');
    const next = await new Promise<PublicRoomState>((resolve, reject) => {
      socket.emit('lobby:rematch', { roomId: room.id }, (ack) => {
        if (ack.ok) resolve(ack.data);
        else reject(new Error(ack.error.message));
      });
    });
    set({ room: next, game: null, events: [] });
    return next;
  },

  kickPlayer: async (playerId) => {
    const room = get().room;
    if (!room) throw new Error('Join a room first.');
    await new Promise<void>((resolve, reject) => {
      socket.emit('lobby:kick', { roomId: room.id, playerId }, (ack) => {
        if (ack.ok) resolve();
        else reject(new Error(ack.error.message));
      });
    });
  },

  transferHost: async (playerId) => {
    const room = get().room;
    if (!room) throw new Error('Join a room first.');
    const next = await new Promise<PublicRoomState>((resolve, reject) => {
      socket.emit('lobby:transferHost', { roomId: room.id, playerId }, (ack) => {
        if (ack.ok) resolve(ack.data);
        else reject(new Error(ack.error.message));
      });
    });
    set({ room: next });
    return next;
  },

  sendChat: async (text) => {
    const room = get().room;
    if (!room) throw new Error('Join a room first.');
    return await new Promise<ChatMessage>((resolve, reject) => {
      socket.emit('chat:send', { roomId: room.id, text }, (ack) => {
        if (ack.ok) resolve(ack.data);
        else reject(new Error(ack.error.message));
      });
    });
  },

  sendGameAction: async (type, payload) => {
    const { room, game } = get();
    if (!room || !game) throw new Error('No active game.');
    const next = await new Promise<AuthoritativeGameState>((resolve, reject) => {
      socket.emit(
        'game:action',
        {
          roomId: room.id,
          action: {
            actionId: createClientId(),
            expectedVersion: game.version,
            type,
            ...(payload === undefined ? {} : { payload })
          }
        },
        (ack) => {
          if (ack.ok) resolve(ack.data);
          else reject(new Error(ack.error.message));
        }
      );
    });
    set({ game: next });
    return next;
  },

  clearError: () => set({ error: null })
}));

function requestWithAck<T>(
  operation: string,
  emit: (
    ack: (response: { ok: true; data: T } | { ok: false; error: { message: string } }) => void
  ) => void
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`El servidor tardó demasiado en ${operation}.`)),
      12_000
    );
    emit((response) => {
      window.clearTimeout(timer);
      if (response.ok) resolve(response.data);
      else reject(new Error(response.error.message));
    });
  });
}

let initialized = false;
let pendingResumedGame: AuthoritativeGameState | null = null;

function applySession(session: SessionReadyPayload): void {
  saveStoredSession({
    reconnectToken: session.reconnectToken,
    nickname: session.identity.nickname
  });
  useRealtimeStore.setState({
    identity: session.identity,
    reconnectToken: session.reconnectToken,
    room: session.room,
    game: pendingResumedGame?.roomId === session.room?.id ? pendingResumedGame : null,
    sessionPending: false
  });
  pendingResumedGame = null;
}

export function initializeRealtime(): void {
  if (initialized) return;
  initialized = true;

  socket.on('connect', () => {
    useRealtimeStore.setState({ connected: true, error: null });
    const stored = loadStoredSession();
    if (!stored) return;
    useRealtimeStore.setState({ sessionPending: true });
    socket.emit('session:resume', { reconnectToken: stored.reconnectToken }, (ack) => {
      if (ack.ok) applySession(ack.data);
      else useRealtimeStore.setState({ sessionPending: false, reconnectToken: null });
    });
  });
  socket.on('disconnect', () => useRealtimeStore.setState({ connected: false }));
  socket.on('room:state', (room) => useRealtimeStore.setState({ room }));
  socket.on('rooms:changed', () => void useRealtimeStore.getState().listRooms());
  socket.on('game:started', (game) => {
    const current = useRealtimeStore.getState();
    if (current.room?.id === game.roomId) useRealtimeStore.setState({ game });
    else if (!current.room && current.sessionPending) pendingResumedGame = game;
  });
  socket.on('game:state', (game) => {
    const current = useRealtimeStore.getState();
    if (current.room?.id === game.roomId) useRealtimeStore.setState({ game });
    else if (!current.room && current.sessionPending) pendingResumedGame = game;
  });
  socket.on('game:event', (event) =>
    useRealtimeStore.setState((state) => ({ events: [...state.events.slice(-99), event] }))
  );
  socket.on('chat:message', (message) =>
    useRealtimeStore.setState((state) => ({ chat: [...state.chat.slice(-99), message] }))
  );
  socket.on('room:kicked', ({ reason }) =>
    useRealtimeStore.setState({ room: null, game: null, error: reason })
  );
  socket.on('server:error', ({ message }) => useRealtimeStore.setState({ error: message }));
  socket.connect();
}
