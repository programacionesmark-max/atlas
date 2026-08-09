import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  LogOut,
  Play,
  Radio,
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
        <p>Joining room {code}…</p>
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
    <ScreenTransition className="lobby-screen">
      <header className="game-header">
        <Brand compact />
        <button className="back-link" type="button" onClick={() => void handleLeave()}>
          <ArrowLeft /> Back to rooms
        </button>
        <div className="game-header__spacer" />
        <span className="connection-live">
          <span /> Live room
        </span>
      </header>
      <div className="lobby-grid">
        <section className="lobby-roster">
          <div className="lobby-title">
            <div>
              <h1>{room.name}</h1>
              <p>
                <button type="button" onClick={() => void copyRoom('code')}>
                  {copied === 'code' ? 'Code copied' : room.code} <Copy />
                </button>
                <button type="button" onClick={() => void copyRoom('invite')}>
                  {copied === 'invite' ? 'Invitation copied' : 'Copy invitation'} <Copy />
                </button>
                <span>{room.visibility.toLowerCase()}</span>
                <span>{title(room.mode)}</span>
                <span>{mapName(room.mapId)}</span>
              </p>
            </div>
            <div>
              <UsersRound /> {room.playerCount}/{room.maxPlayers}
              <span>Waiting for players</span>
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
                          <Crown /> Host
                        </>
                      ) : null}
                      {player.ready ? <em className="ready">Ready</em> : <em>Not ready</em>}
                      {!player.connected ? <em className="disconnected">Disconnected</em> : null}
                    </span>
                  </div>
                  <span
                    className="token-piece"
                    style={{ color: player.color }}
                    aria-label={`${player.tokenId} token`}
                  />
                  <div className="customization-summary">
                    <span className="color-dot" style={{ backgroundColor: player.color }} />
                    {player.tokenId}
                  </div>
                  {isHost && player.id !== identity?.playerId ? (
                    <div className="lobby-player__host-actions">
                      <button type="button" onClick={() => void transferHost(player.id)}>
                        <Crown /> Make host
                      </button>
                      <button type="button" onClick={() => void kickPlayer(player.id)}>
                        <UserMinus /> Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            {Array.from({ length: Math.max(0, room.maxPlayers - room.playerCount) }, (_, index) => (
              <div className="lobby-player lobby-player--empty" key={`empty-${index}`}>
                <UserPlus />
                <span>
                  <strong>Invite player</strong>
                  <small>Share code {room.code}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
        <aside className="lobby-settings">
          <span className="section-label">Map preview</span>
          <div className="map-preview">
            <img src={selectedMap.image} alt={`${selectedMap.config.name} map preview`} />
            <strong>{selectedMap.config.name}</strong>
          </div>
          <dl className="rules-list">
            <div>
              <dt>Mode</dt>
              <dd>{title(room.mode)}</dd>
            </div>
            <div>
              <dt>Starting cash</dt>
              <dd>${room.settings.rules.startingCash.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Turn timer</dt>
              <dd>
                {room.settings.rules.turnTimerSeconds || 'Unlimited'}
                {room.settings.rules.turnTimerSeconds ? ' sec' : ''}
              </dd>
            </div>
            <div>
              <dt>Auctions</dt>
              <dd>{room.settings.rules.auctionsEnabled ? 'On' : 'Off'}</dd>
            </div>
            <div>
              <dt>Trades</dt>
              <dd>{room.settings.rules.tradesEnabled ? 'On' : 'Off'}</dd>
            </div>
            <div>
              <dt>Events</dt>
              <dd>{room.settings.rules.economicEventsEnabled ? 'On' : 'Off'}</dd>
            </div>
          </dl>
          <p className="host-note">
            {isHost ? (
              <>
                <Crown /> You are the host.
              </>
            ) : (
              <>The host controls the rules.</>
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
            <LogOut /> Leave room
          </button>
          <button
            className={currentPlayer?.ready ? 'button button--ready' : 'button button--secondary'}
            type="button"
            disabled={pending}
            onClick={() => void handleReady()}
          >
            <Check />
            {currentPlayer?.ready ? 'Ready' : 'I’m ready'}
          </button>
          {isHost ? (
            <button
              className="button button--primary"
              type="button"
              disabled={!canStart || pending}
              onClick={() => void handleStart()}
            >
              <Play /> Start game
            </button>
          ) : (
            <div className="waiting-host">
              <Radio className="spin-slow" /> Waiting for host
            </div>
          )}
        </div>
      </div>
    </ScreenTransition>
  );
}

function title(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');
}
function mapName(value: string): string {
  if (value === 'world-capital-routes') return 'Rutas del Mundo';
  if (value === 'neon-city') return 'World Capitals';
  return value.split('-').map(title).join(' ');
}
