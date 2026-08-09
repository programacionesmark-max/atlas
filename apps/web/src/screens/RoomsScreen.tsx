import type { RoomSettings } from '@circuit/shared';
import { ArrowLeft, Clock3, LockKeyhole, RefreshCw, Search, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { CreateRoomDrawer } from '../components/CreateRoomDrawer';
import { PageShell } from '../components/PageShell';
import { ScreenTransition } from '../components/ScreenTransition';
import { loadStoredSession } from '../lib/session-storage';
import { useRealtimeStore } from '../store/realtime';

export function RoomsScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rooms = useRealtimeStore((state) => state.rooms);
  const listRooms = useRealtimeStore((state) => state.listRooms);
  const createRoom = useRealtimeStore((state) => state.createRoom);
  const joinRoom = useRealtimeStore((state) => state.joinRoom);
  const leaveRoom = useRealtimeStore((state) => state.leaveRoom);
  const identity = useRealtimeStore((state) => state.identity);
  const currentRoom = useRealtimeStore((state) => state.room);
  const [search, setSearch] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const showDrawer = params.has('create');

  useEffect(() => {
    if (!identity && !loadStoredSession()) {
      void navigate('/', { replace: true });
      return;
    }
    if (!identity) return;
    void listRooms().finally(() => setLoading(false));
  }, [identity, listRooms, navigate]);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? rooms.filter(
          (room) =>
            room.name.toLowerCase().includes(query) || room.code.toLowerCase().includes(query)
        )
      : rooms;
  }, [rooms, search]);

  async function handleJoin(roomCode: string, roomPassword?: string): Promise<void> {
    const room = await joinRoom(roomCode, roomPassword);
    void navigate(`/room/${room.code}`);
  }

  async function handleCodeSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    await handleJoin(code, password || undefined);
  }

  async function handleCreate(settings: RoomSettings, roomPassword?: string): Promise<void> {
    if (currentRoom?.status === 'IN_GAME' || currentRoom?.status === 'STARTING') {
      throw new Error('Ya tienes una partida activa. Vuelve a ella antes de crear un lobby nuevo.');
    }
    if (currentRoom) await leaveRoom();
    const room = await createRoom(settings, roomPassword);
    void navigate(`/room/${room.code}`);
  }

  return (
    <PageShell>
      <ScreenTransition className={showDrawer ? 'rooms-layout is-creating' : 'rooms-layout'}>
        <section className="rooms-main">
          <Link to="/" className="back-link">
            <ArrowLeft /> Back to home
          </Link>
          <div className="rooms-heading">
            <div>
              <h1>Public rooms</h1>
              <p>Find a table and make your move.</p>
            </div>
            <button
              className="button button--primary"
              type="button"
              onClick={() => setParams({ create: 'public' })}
            >
              Create game
            </button>
          </div>
          <div className="room-toolbar">
            <label className="search-field">
              <Search />
              <input
                aria-label="Search rooms"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search rooms"
              />
            </label>
            <button
              type="button"
              className="icon-button"
              onClick={() => void listRooms()}
              aria-label="Refresh rooms"
            >
              <RefreshCw />
            </button>
          </div>
          <div className="room-list" aria-live="polite">
            <div className="room-list__header">
              <span>Room</span>
              <span>Mode / map</span>
              <span>Players</span>
              <span>Access</span>
            </div>
            {loading ? <div className="room-empty">Loading live rooms…</div> : null}
            {!loading && filteredRooms.length === 0 ? (
              <div className="room-empty">
                <UsersRound />
                <h2>No open rooms</h2>
                <p>Create one and invite another player with its code.</p>
              </div>
            ) : null}
            {filteredRooms.map((room) => (
              <div className="room-row" key={room.id}>
                <div>
                  <strong>{room.name}</strong>
                  <span>{room.code}</span>
                </div>
                <div>
                  <strong>{title(room.mode)}</strong>
                  <span>{mapName(room.mapId)}</span>
                </div>
                <div className="room-count">
                  <UsersRound />
                  {room.playerCount}/{room.maxPlayers}
                </div>
                <div className="room-access">
                  {room.requiresPassword ? <LockKeyhole /> : null}
                  <button
                    type="button"
                    className="button button--outline"
                    onClick={() => void handleJoin(room.code)}
                    disabled={room.playerCount >= room.maxPlayers}
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
          <form className="join-code" onSubmit={(event) => void handleCodeSubmit(event)}>
            <div>
              <span className="section-label">Join by code</span>
              <p>Enter a six-character room code.</p>
            </div>
            <input
              aria-label="Room code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="AB7F92"
              minLength={6}
              maxLength={6}
              required
            />
            <input
              aria-label="Room password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password (if set)"
            />
            <button className="button button--outline" type="submit">
              Join
            </button>
          </form>
          <p className="realtime-note">
            <Clock3 /> Room availability updates live.
          </p>
        </section>
        {showDrawer ? (
          <CreateRoomDrawer
            initialPrivate={params.get('create') === 'private'}
            initialMapId={params.get('map')}
            initialMode={params.get('mode') as RoomSettings['mode'] | null}
            onClose={() => setParams({})}
            onCreate={handleCreate}
          />
        ) : null}
      </ScreenTransition>
    </PageShell>
  );
}

function title(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');
}
function mapName(value: string): string {
  if (value === 'neon-city') return 'World Capitals';
  return value.split('-').map(title).join(' ');
}
