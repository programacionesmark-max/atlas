import type { ClientToServerEvents, ServerToClientEvents } from '@circuit/shared';
import { io, type Socket } from 'socket.io-client';

const configuredServerUrl = import.meta.env.VITE_SERVER_URL as unknown as string | undefined;
export const serverUrl =
  configuredServerUrl ??
  (typeof window === 'undefined' ? 'http://localhost:3001' : window.location.origin);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
  autoConnect: false,
  transports: import.meta.env.PROD ? ['websocket'] : ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5_000,
  timeout: 8_000
});
