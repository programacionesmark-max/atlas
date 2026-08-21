import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  LogOut,
  Play,
  Radio,
  Settings2,
  UserPlus,
  UserMinus,
  UsersRound
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Brand } from '../components/Brand';
import { ChatPanel } from '../components/ChatPanel';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { ScreenTransition } from '../components/ScreenTransition';
import { getAtlasMap } from '../data/atlas';
import { loadStoredSession } from '../lib/session-storage';
import { useRealtimeStore } from '../store/realtime';

export function LobbyScreen() {
  const navigate = useNavigate();
  const { code = '' } = useParams();
  const room = useRealtimeStore((state) => state.room);
  const game = useRealtimeStore((state) => state.game);
  const identity = useRealtimeStore((state) => state.identity);
  const joinRoom = useRealtimeStore((state) => state.joinRoom);
  const leaveRoom = useRealtimeStore((state) => state.leaveRoom);
  const setReady = useRealtimeStore((state) => state.setReady);
  const startGame = useRealtimeStore((state) => state.startGame);
  const kickPlayer = useRealtimeStore((state) => state.kickPlayer);
  const transferHost = useRealtimeStore((state) => state.transferHost);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<'code' | 'invite' | null>(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    if (!identity && !loadStoredSession()) {
      void navigate(`/join/${code}`, { replace: true });
      return;
    }
    if (!room && code) void joinRoom(code).catch(() => navigate('/rooms', { replace: true }));
  }, [code, identity, joinRoom, navigate, room]);

  useEffect(() => {
    if (game) void navigate(`/game/${game.gameId}`);
  }, [game, navigate]);

  const currentPlayer = room?.players.find((player) => player.id === identity?.playerId);
  const isHost = currentPlayer?.isHost ?? false;
  const canStart = useMemo(() => {
    const active = room?.players.filter((player) => player.role === 'PLAYER') ?? [];
    return active.length >= 2 && active.every((player) => player.ready);
  }, [room]);

  if (!room)
    return (
      <div className="centered-status">
        <Radio className="spin-slow" />
        <p>Entrando en la sala {code}…</p>
      </div>
    );
  const selectedMap = getAtlasMap(room.mapId);

  async function handleLeave(): Promise<void> {
    await leaveRoom();
    void navigate('/rooms');
  }

  async function handleReady(): Promise<void> {
    if (!currentPlayer) return;
    setPending(true);
    try {
      await setReady(!currentPlayer.ready);
    } finally {
      setPending(false);
    }
  }

  async function handleStart(): Promise<void> {
    setPending(true);
    try {
      const next = await startGame();
      void navigate(`/game/${next.gameId}`);
    } finally {
      setPending(false);
    }
  }

  async function copyRoom(value: 'code' | 'invite'): Promise<void> {
    if (!room) return;
    const text = value === 'code' ? room.code : `${window.location.origin}/join/${room.code}`;
    await navigator.clipboard.writeText(text);
    setCopied(value);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <ScreenTransition className="lobby-screen final-lobby">
      <header className="game-header lobby-header">
        <Brand compact />
        <button className="back-link" type="button" onClick={() => void handleLeave()}>
          <ArrowLeft /> Salas
        </button>
        <div className="game-header__spacer" />
        <div className="lobby-room-code">
          <small>Sala {room.visibility === 'PRIVATE' ? 'privada' : 'pública'}</small>
          <strong>{room.code}</strong>
        </div>
        <span className="connection-live">
          <span /> En directo
        </span>
      </header>
      <div className="lobby-progress" aria-label="Progreso para empezar">
        <span className="is-complete">
          <b>1</b> Crear sala
        </span>
        <i />
        <span className="is-active">
          <b>2</b> Invitar
        </span>
        <i />
        <span>
          <b>3</b> Jugar
        </span>
      </div>
      <div className="lobby-grid">
        <section className="lobby-roster">
          <div className="lobby-title">
            <div>
              <span className="section-label">{room.name}</span>
              <h1>
                Jugadores {room.playerCount}/{room.maxPlayers}
              </h1>
              <p>
                <button type="button" onClick={() => void copyRoom('code')}>
                  {copied === 'code' ? 'Código copiado' : `Código ${room.code}`} <Copy />
                </button>
                <button type="button" onClick={() => void copyRoom('invite')}>
                  {copied === 'invite' ? 'Invitación copiada' : 'Copiar invitación'} <Copy />
                </button>
              </p>
            </div>
            <div>
              <UsersRound /> {room.playerCount}/{room.maxPlayers}
              <span>{canStart ? 'Todo listo' : 'Esperando jugadores'}</span>
            </div>
          </div>
          <div className="player-slots">
            {room.players
              .filter((player) => player.role === 'PLAYER')
              .map((player, index) => (
                <div
                  className={
                    player.id === identity?.playerId ? 'lobby-player is-self' : 'lobby-player'
                  }
                  key={player.id}
                >
                  <span className="player-number">{index + 1}</span>
                  <PlayerAvatar name={player.nickname} color={player.color} size={62} />
                  <div className="lobby-player__identity">
                    <strong>{player.nickname}</strong>
                    <span>
                      {player.isHost ? (
                        <>
                          <Crown /> Anfitrión
                        </>
                      ) : null}
                      {player.ready ? <em className="ready">Listo</em> : <em>Preparándose</em>}
                      {!player.connected ? <em className="disconnected">Desconectado</em> : null}
                    </span>
                  </div>
                  <span
                    className="token-piece"
                    style={{ color: player.color }}
                    aria-label={`Ficha ${player.tokenId}`}
                  />
                  <div className="customization-summary">
                    <span className="color-dot" style={{ backgroundColor: player.color }} />
                    {player.tokenId}
                  </div>
                  {isHost && player.id !== identity?.playerId ? (
                    <div className="lobby-player__host-actions">
                      <button type="button" onClick={() => void transferHost(player.id)}>
                        <Crown /> Dar anfitrión
                      </button>
                      <button type="button" onClick={() => void kickPlayer(player.id)}>
                        <UserMinus /> Expulsar
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            {Array.from({ length: Math.max(0, room.maxPlayers - room.playerCount) }, (_, index) => (
              <button
                className="lobby-player lobby-player--empty"
                type="button"
                onClick={() => void copyRoom('invite')}
                key={`empty-${index}`}
              >
                <UserPlus />
                <span>
                  <strong>Invitar jugador</strong>
                  <small>Copiar enlace de la sala</small>
                </span>
              </button>
            ))}
          </div>
        </section>
        <aside className="lobby-settings">
          <span className="section-label">Partida</span>
          <div className="map-preview">
            <img src={selectedMap.image} alt={`Vista previa de ${selectedMap.config.name}`} />
            <strong>{selectedMap.config.name}</strong>
          </div>
          <dl className="rules-list rules-list--essential">
            <div>
              <dt>Modo</dt>
              <dd>{title(room.mode)}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>
                {room.settings.rules.maxRounds
                  ? `${room.settings.rules.maxRounds} rondas`
                  : 'Sin límite'}
              </dd>
            </div>
            <div>
              <dt>Dinero inicial</dt>
              <dd>${room.settings.rules.startingCash.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Turno</dt>
              <dd>
                {room.settings.rules.turnTimerSeconds
                  ? `${room.settings.rules.turnTimerSeconds} s`
                  : 'Sin límite'}
              </dd>
            </div>
          </dl>
          <button
            className="lobby-rules-toggle"
            type="button"
            onClick={() => setShowRules((value) => !value)}
          >
            <Settings2 /> {showRules ? 'Ocultar reglas' : 'Ver reglas'}
          </button>
          {showRules ? (
            <dl className="rules-list rules-list--advanced">
              <div>
                <dt>Subastas</dt>
                <dd>{room.settings.rules.auctionsEnabled ? 'Sí' : 'No'}</dd>
              </div>
              <div>
                <dt>Intercambios</dt>
                <dd>{room.settings.rules.tradesEnabled ? 'Sí' : 'No'}</dd>
              </div>
              <div>
                <dt>Cartas Atlas</dt>
                <dd>{room.settings.rules.economicEventsEnabled ? 'Sí' : 'No'}</dd>
              </div>
              <div>
                <dt>Dobles</dt>
                <dd>{room.settings.rules.doublesExtraRoll ? 'Turno extra' : 'Normal'}</dd>
              </div>
            </dl>
          ) : null}
          <p className="host-note">
            {isHost ? (
              <>
                <Crown /> Tú controlas el inicio.
              </>
            ) : (
              <>El anfitrión controla las reglas.</>
            )}
          </p>
        </aside>
        <ChatPanel compact />
        <div className="lobby-actions">
          <button
            className="button button--danger"
            type="button"
            onClick={() => void handleLeave()}
          >
            <LogOut /> Salir
          </button>
          <button
            className={currentPlayer?.ready ? 'button button--ready' : 'button button--secondary'}
            type="button"
            disabled={pending}
            onClick={() => void handleReady()}
          >
            <Check />
            {currentPlayer?.ready ? 'Listo' : 'Estoy listo'}
          </button>
          {isHost ? (
            <button
              className="button button--primary"
              type="button"
              disabled={!canStart || pending}
              onClick={() => void handleStart()}
            >
              <Play /> Empezar partida
            </button>
          ) : (
            <div className="waiting-host">
              <Radio className="spin-slow" /> Esperando al anfitrión
            </div>
          )}
        </div>
      </div>
    </ScreenTransition>
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
