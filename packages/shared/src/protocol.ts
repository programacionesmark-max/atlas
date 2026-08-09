import type {
  Ack,
  AuthoritativeGameState,
  ChatMessage,
  GameEventMessage,
  PublicRoomState,
  PublicRoomSummary,
  SessionReadyPayload
} from './types.js';
import type {
  ChatMessageInput,
  CreateRoomInput,
  CreateSessionInput,
  EmoteInput,
  GameActionInput,
  JoinRoomInput,
  KickPlayerInput,
  LeaveRoomInput,
  ListRoomsInput,
  PingInput,
  QuickPlayInput,
  ReadyInput,
  RematchInput,
  ResumeSessionInput,
  StartGameInput,
  TransferHostInput,
  UpdatePlayerInput,
  UpdateSettingsInput
} from './schemas.js';

export type SocketAck<T = void> = (result: Ack<T>) => void;

export interface ClientToServerEvents {
  'session:create': (payload: CreateSessionInput, ack: SocketAck<SessionReadyPayload>) => void;
  'session:resume': (payload: ResumeSessionInput, ack: SocketAck<SessionReadyPayload>) => void;
  'rooms:list': (payload: ListRoomsInput, ack: SocketAck<PublicRoomSummary[]>) => void;
  'room:create': (payload: CreateRoomInput, ack: SocketAck<PublicRoomState>) => void;
  'room:join': (payload: JoinRoomInput, ack: SocketAck<PublicRoomState>) => void;
  'room:quickPlay': (payload: QuickPlayInput, ack: SocketAck<PublicRoomState>) => void;
  'room:leave': (payload: LeaveRoomInput, ack: SocketAck) => void;
  'lobby:setReady': (payload: ReadyInput, ack: SocketAck<PublicRoomState>) => void;
  'lobby:updatePlayer': (payload: UpdatePlayerInput, ack: SocketAck<PublicRoomState>) => void;
  'lobby:updateSettings': (payload: UpdateSettingsInput, ack: SocketAck<PublicRoomState>) => void;
  'lobby:start': (payload: StartGameInput, ack: SocketAck<AuthoritativeGameState>) => void;
  'lobby:rematch': (payload: RematchInput, ack: SocketAck<PublicRoomState>) => void;
  'lobby:kick': (payload: KickPlayerInput, ack: SocketAck) => void;
  'lobby:transferHost': (payload: TransferHostInput, ack: SocketAck<PublicRoomState>) => void;
  'game:action': (payload: GameActionInput, ack: SocketAck<AuthoritativeGameState>) => void;
  'chat:send': (payload: ChatMessageInput, ack: SocketAck<ChatMessage>) => void;
  'player:emote': (payload: EmoteInput, ack: SocketAck) => void;
  ping: (payload: PingInput, ack: SocketAck<{ serverTime: number; sentAt: number }>) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: PublicRoomState) => void;
  'rooms:changed': () => void;
  'player:joined': (payload: { roomId: string; playerId: string; nickname: string }) => void;
  'player:left': (payload: { roomId: string; playerId: string; nickname: string }) => void;
  'player:connectivity': (payload: {
    roomId: string;
    playerId: string;
    connected: boolean;
  }) => void;
  'host:changed': (payload: { roomId: string; hostPlayerId: string }) => void;
  'game:started': (state: AuthoritativeGameState) => void;
  'game:state': (state: AuthoritativeGameState) => void;
  'game:event': (event: GameEventMessage) => void;
  'chat:message': (message: ChatMessage) => void;
  'emote:shown': (payload: {
    roomId: string;
    playerId: string;
    emoteId: string;
    expiresAt: string;
  }) => void;
  'room:kicked': (payload: { roomId: string; reason: string }) => void;
  'server:error': (payload: { code: string; message: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId?: string;
  playerId?: string;
  guest?: boolean;
  roomId?: string;
}
