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
  const identity = useRealtimeStore((state) => state.identity);
  const [search, setSearch] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
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
    setJoinError(null);
    try {
      const room = await joinRoom(roomCode, roomPassword);
      void navigate(`/room/${room.code}`);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'No se pudo entrar en la sala.');
    }
  }

  async function handleCodeSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    await handleJoin(code, password || undefined);
  }

  async function handleCreate(settings: RoomSettings, roomPassword?: string): Promise<void> {
    const room = await createRoom(settings, roomPassword);
    void navigate(`/room/${room.code}`);
  }

  return (
    <PageShell>
      <ScreenTransition className={showDrawer ? 'rooms-layout is-creating' : 'rooms-layout'}>
        <section className="rooms-main">
          <Link to="/" className="back-link">
            <ArrowLeft /> Volver al inicio
          </Link>
          <div className="rooms-heading">
            <div>
              <span className="section-label">Multijugador en directo</span>
              <h1>Salas públicas</h1>
              <p>Únete a una mesa o crea una nueva en segundos.</p>
            </div>
            <button
              className="button button--primary"
              type="button"
              onClick={() => setParams({ create: 'public' })}
            >
              Crear partida
            </button>
          </div>
          <div className="room-toolbar">
            <label className="search-field">
              <Search />
              <input
                aria-label="Buscar salas"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre o código"
              />
            </label>
            <button
              type="button"
              className="icon-button"
              onClick={() => void listRooms()}
              aria-label="Actualizar salas"
            >
              <RefreshCw />
            </button>
          </div>
          <div className="room-list" aria-live="polite">
            <div className="room-list__header">
              <span>Sala</span>
              <span>Modo / tablero</span>
              <span>Jugadores</span>
              <span>Acceso</span>
            </div>
            {loading ? <div className="room-empty">Buscando salas disponibles…</div> : null}
            {!loading && filteredRooms.length === 0 ? (
              <div className="room-empty">
                <UsersRound />
                <h2>No hay salas abiertas</h2>
                <p>Crea una y comparte su código para empezar.</p>
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
                    Entrar
                  </button>
                </div>
              </div>
            ))}
          </div>
          <form className="join-code" onSubmit={(event) => void handleCodeSubmit(event)}>
            <div>
              <span className="section-label">Entrar con código</span>
              <p>Escribe el código de seis caracteres.</p>
            </div>
            <input
              aria-label="Código de sala"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="AB7F92"
              minLength={6}
              maxLength={6}
              required
            />
            <input
              aria-label="Contraseña de sala"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña (si existe)"
            />
            <button className="button button--outline" type="submit">
              Entrar
            </button>
          </form>
          {joinError ? (
            <div className="rooms-error" role="alert">
              {joinError}
              <button type="button" onClick={() => setJoinError(null)}>
                Cerrar
              </button>
            </div>
          ) : null}
          <p className="realtime-note">
            <Clock3 /> La disponibilidad se actualiza en tiempo real.
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
  const translated: Record<string, string> = {
    CLASSIC: 'Clásico',
    BLITZ: 'Blitz',
    CHAOS: 'Caos',
    TYCOON: 'Magnate',
    TEAMS: 'Equipos',
    SURVIVAL: 'Supervivencia',
    DUEL: 'Duelo',
    PROPERTY_RUSH: 'Fiebre inmobiliaria',
    CUSTOM: 'A medida'
  };
  if (translated[value]) return translated[value];
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');
}
function mapName(value: string): string {
  if (value === 'world-capital-routes') return 'Rutas del Mundo';
  if (value === 'neon-city') return 'World Capitals';
  return value.split('-').map(title).join(' ');
}
