import type { GameState } from '@circuit/game-engine';
import type { JsonValue } from '@circuit/shared';
import {
  ArrowLeftRight,
  Banknote,
  Clock3,
  Flag,
  Handshake,
  Menu,
  MessageCircle,
  ShieldAlert,
  Send,
  UsersRound
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AuctionModal } from '../components/AuctionModal';
import { BankruptcyConfirm } from '../components/BankruptcyConfirm';
import { soundManager } from '../audio/sound-manager';
import { useChatAudio, useGameAudio } from '../audio/use-game-audio';
import { Brand } from '../components/Brand';
import { GameBoard } from '../components/GameBoard';
import { FlightDecision } from '../components/FlightDecision';
import { PlayerRail } from '../components/PlayerRail';
import { PropertyInspector } from '../components/PropertyInspector';
import { RoundEventModal } from '../components/RoundEventModal';
import { ScreenTransition } from '../components/ScreenTransition';
import { TradeModal } from '../components/TradeModal';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { getAtlasMap, type VisualTile } from '../data/atlas';
import { loadStoredSession } from '../lib/session-storage';
import { useRealtimeStore } from '../store/realtime';

export function GameScreen() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const wrapped = useRealtimeStore((store) => store.game);
  const room = useRealtimeStore((store) => store.room);
  const identity = useRealtimeStore((store) => store.identity);
  const chat = useRealtimeStore((store) => store.chat);
  const sendChat = useRealtimeStore((store) => store.sendChat);
  const sendGameAction = useRealtimeStore((store) => store.sendGameAction);
  const rematch = useRealtimeStore((store) => store.rematch);
  const [selectedTile, setSelectedTile] = useState<VisualTile>(
    getAtlasMap('world-capital-routes').tiles[0]!
  );
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTrade, setShowTrade] = useState(false);
  const [showBankruptcy, setShowBankruptcy] = useState(false);
  const [dismissedRoundEventId, setDismissedRoundEventId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'board' | 'players' | 'chat' | 'actions'>('board');
  const [message, setMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const state = useMemo(() => parseGameState(wrapped?.state), [wrapped?.state]);
  useGameAudio(state, identity?.playerId ?? null);
  useChatAudio(chat, identity?.playerId ?? null);

  useEffect(() => {
    if (!identity && !loadStoredSession()) void navigate('/', { replace: true });
    else if (identity && !room) void navigate('/rooms', { replace: true });
  }, [identity, navigate, room]);

  useEffect(() => {
    if (!state) return;
    const current = state.turnOrder[state.currentPlayerIndex];
    const position = current ? state.players[current]?.positionTileId : undefined;
    const tile = getAtlasMap(state.mapId).tiles.find((item) => item.id === position);
    if (tile) setSelectedTile(tile);
  }, [state]);

  useEffect(() => {
    if (!state || !identity) return;
    const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
    if (
      currentPlayerId === identity.playerId &&
      (state.phase === 'PROPERTY_DECISION' ||
        state.phase === 'FLIGHT_DECISION' ||
        state.phase === 'PAYMENT')
    )
      setMobilePanel('actions');
  }, [identity, state]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chat.length]);

  const dismissRoundEvent = useCallback((eventId: string) => {
    setDismissedRoundEventId(eventId);
  }, []);

  async function action(type: string, payload?: JsonValue): Promise<void> {
    setPending(true);
    setActionError(null);
    try {
      await sendGameAction(type, payload);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action rejected by server.');
    } finally {
      setPending(false);
    }
  }

  async function submitMessage(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!message.trim()) return;
    try {
      await sendChat(message.trim());
      setMessage('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.');
    }
  }

  async function sendQuickMessage(text: string): Promise<void> {
    try {
      await sendChat(text);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.');
    }
  }

  if (!room || !identity || !state || !wrapped || wrapped.gameId !== gameId) {
    return (
      <div className="centered-status">
        <Clock3 className="spin-slow" />
        <p>Restoring authoritative game state…</p>
      </div>
    );
  }

  const currentId = state.turnOrder[state.currentPlayerIndex] ?? null;
  const current = currentId ? state.players[currentId] : null;
  const isMyTurn = currentId === identity.playerId;
  const canRoll = isMyTurn && (state.phase === 'TURN_START' || state.phase === 'JAIL');
  const canEnd = isMyTurn && state.phase === 'TURN_END';
  const actionRequired =
    isMyTurn &&
    (state.phase === 'PROPERTY_DECISION' ||
      state.phase === 'FLIGHT_DECISION' ||
      state.phase === 'PAYMENT' ||
      state.phase === 'ROUND_EVENT' ||
      state.phase === 'TURN_END');
  const eventActivity = state.activity.slice(-30);
  const openTrade = Object.values(state.trades).some(
    (trade) => trade.status === 'OPEN' && trade.recipientId === identity.playerId
  );
  const visibleRoundEvent =
    state.pendingRoundEvent ??
    (state.lastRoundEvent?.id !== dismissedRoundEventId ? state.lastRoundEvent : null);

  return (
    <ScreenTransition className="game-screen">
      <header className="game-topbar">
        <Brand compact />
        <div className="turn-heading">
          <strong>{isMyTurn ? 'Your turn' : `${current?.name ?? '—'}’s turn`}</strong>
          <span>{state.phase.replaceAll('_', ' ')}</span>
        </div>
        <TurnTimer startedAt={state.turnStartedAt} durationMs={state.rules.turnTimeMs} />
        <span className="state-version">State #{wrapped.version}</span>
        <button
          className="icon-button"
          type="button"
          onClick={() => void navigate(`/room/${room.code}`)}
          aria-label="Game menu"
        >
          <Menu />
        </button>
      </header>

      {actionError ? (
        <div className="action-error" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="game-layout">
        <div
          className={`desktop-player-rail${mobilePanel === 'players' ? ' mobile-drawer is-open' : ''}`}
        >
          <PlayerRail state={state} room={room} />
        </div>
        <GameBoard
          state={state}
          room={room}
          onSelectTile={(tile) => {
            setSelectedTile(tile);
            setMobilePanel('actions');
          }}
          onRoll={() => {
            soundManager.play('dice');
            void action('ROLL_DICE', {});
          }}
          onEndTurn={() => void action('END_TURN', {})}
          canRoll={canRoll}
          canEndTurn={canEnd}
          pending={pending}
        />
        <div
          className={`desktop-inspector${mobilePanel === 'actions' ? ' mobile-drawer is-open' : ''}`}
        >
          <PropertyInspector
            state={state}
            tile={selectedTile}
            viewerId={identity.playerId}
            pending={pending}
            onAction={(type, payload) => void action(type, payload ?? {})}
            onTrade={() => setShowTrade(true)}
          />
          <div className="turn-actions game-action-dock">
            <span className="game-action-dock__label">Centro de acciones</span>
            <button
              className={openTrade ? 'button action-tile has-notice' : 'button action-tile'}
              type="button"
              onClick={() => setShowTrade(true)}
              disabled={!room.settings.rules.tradesEnabled}
            >
              <span>
                <ArrowLeftRight />
              </span>
              <strong>Trade</strong>
              <small>{openTrade ? 'Oferta esperando' : 'Negocia ciudades'}</small>
            </button>
            <button
              className="button action-tile action-tile--danger"
              type="button"
              onClick={() => setShowBankruptcy(true)}
              disabled={state.players[identity.playerId]?.status !== 'ACTIVE'}
            >
              <span>
                <ShieldAlert />
              </span>
              <strong>Bancarrota</strong>
              <small>Abandonar partida</small>
            </button>
            {state.paymentDue?.debtorId === identity.playerId ? (
              <>
                <button
                  className="button button--ready"
                  type="button"
                  disabled={pending}
                  onClick={() => void action('SETTLE_DEBT', {})}
                >
                  <Banknote /> Pay debt
                </button>
                <button
                  className="button button--danger"
                  type="button"
                  disabled={pending}
                  onClick={() => void action('DECLARE_BANKRUPTCY', {})}
                >
                  <Flag /> Bancarrota por deuda
                </button>
              </>
            ) : null}
            {canEnd ? (
              <button
                className="button button--secondary"
                type="button"
                disabled={pending}
                onClick={() => void action('END_TURN', {})}
              >
                End turn
              </button>
            ) : null}
          </div>
        </div>

        <section className="activity-panel">
          <span className="section-label">Activity feed</span>
          <div>
            {eventActivity.length ? (
              eventActivity.map((entry) => <p key={entry.id}>{entry.message}</p>)
            ) : (
              <p>Game started. The bank is ready.</p>
            )}
          </div>
        </section>
        <section
          className={mobilePanel === 'chat' ? 'game-chat mobile-drawer is-open' : 'game-chat'}
        >
          <header className="game-chat__header">
            <span>
              <MessageCircle />
            </span>
            <div>
              <strong>Chat de mesa</strong>
              <small>{room.playerCount} jugadores conectados</small>
            </div>
          </header>
          <div className="game-chat__messages" aria-live="polite">
            {chat.length === 0 ? (
              <p className="game-chat__empty">La mesa está en silencio. Rompe el hielo.</p>
            ) : null}
            {chat.slice(-12).map((entry) => (
              <article
                className={
                  entry.playerId === identity.playerId ? 'chat-bubble is-self' : 'chat-bubble'
                }
                key={entry.id}
              >
                <span>{entry.nickname.slice(0, 1).toUpperCase()}</span>
                <p>
                  <strong>{entry.nickname}</strong>
                  {entry.text}
                </p>
              </article>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="game-chat__quick" aria-label="Mensajes rápidos">
            <button type="button" onClick={() => void sendQuickMessage('¡Buena jugada!')}>
              ✨ Buena jugada
            </button>
            <button type="button" onClick={() => void sendQuickMessage('¿Hacemos un trato?')}>
              <Handshake /> ¿Trato?
            </button>
          </div>
          <form onSubmit={(event) => void submitMessage(event)}>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={280}
              placeholder="Escribe a la mesa…"
              aria-label="Mensaje para los jugadores"
            />
            <button type="submit" disabled={!message.trim()} aria-label="Send">
              <Send />
            </button>
          </form>
        </section>
      </div>

      <nav className="mobile-game-nav" aria-label="Game panels">
        <button
          type="button"
          className={mobilePanel === 'players' ? 'is-active' : ''}
          onClick={() => setMobilePanel('players')}
        >
          <UsersRound />
          Players
        </button>
        <button
          type="button"
          className={mobilePanel === 'board' ? 'is-active' : ''}
          onClick={() => setMobilePanel('board')}
        >
          <span className="nav-board-icon" />
          Board
        </button>
        <button
          type="button"
          className={mobilePanel === 'chat' ? 'is-active' : ''}
          onClick={() => setMobilePanel('chat')}
        >
          <MessageCircle />
          Chat{chat.length ? <i>{Math.min(chat.length, 9)}</i> : null}
        </button>
        <button
          type="button"
          className={`${mobilePanel === 'actions' ? 'is-active' : ''}${actionRequired ? ' has-action' : ''}`}
          onClick={() => setMobilePanel('actions')}
        >
          <Banknote />
          {actionRequired ? <i>!</i> : null}
          Actions
        </button>
      </nav>

      {state.auction ? (
        <AuctionModal
          state={state}
          viewerId={identity.playerId}
          pending={pending}
          onAction={(type, payload) => void action(type, payload ?? {})}
        />
      ) : null}
      {state.pendingFlightDecision ? (
        <FlightDecision
          state={state}
          viewerId={identity.playerId}
          pending={pending}
          onAction={(type, payload) => void action(type, payload ?? {})}
        />
      ) : null}
      {showTrade ? (
        <TradeModal
          state={state}
          viewerId={identity.playerId}
          pending={pending}
          onClose={() => setShowTrade(false)}
          onAction={(type, payload) => void action(type, payload as JsonValue)}
        />
      ) : null}
      {showBankruptcy ? (
        <BankruptcyConfirm
          pending={pending}
          onClose={() => setShowBankruptcy(false)}
          onConfirm={() => {
            void action('FORFEIT_GAME', {}).then(() => setShowBankruptcy(false));
          }}
        />
      ) : null}
      {visibleRoundEvent ? (
        <RoundEventModal
          pendingEvent={state.pendingRoundEvent}
          result={state.pendingRoundEvent ? null : state.lastRoundEvent}
          playerName={
            state.players[state.pendingRoundEvent?.playerId ?? state.lastRoundEvent?.playerId ?? '']
              ?.name ?? 'un jugador'
          }
          canReveal={
            Boolean(state.pendingRoundEvent) &&
            (state.pendingRoundEvent?.playerId === identity.playerId ||
              currentId === identity.playerId)
          }
          pending={pending}
          onReveal={(cardIndex) => void action('REVEAL_ROUND_EVENT', { cardIndex })}
          onDismiss={() => dismissRoundEvent(visibleRoundEvent.id)}
        />
      ) : null}
      {state.phase === 'GAME_OVER' ? (
        <VictoryOverlay
          state={state}
          room={room}
          viewerId={identity.playerId}
          onRematch={async () => {
            await rematch();
          }}
        />
      ) : null}
    </ScreenTransition>
  );
}

function TurnTimer({
  startedAt,
  durationMs
}: {
  startedAt: number | null;
  durationMs: number | null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt || !durationMs) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [durationMs, startedAt]);
  const remaining =
    startedAt && durationMs ? Math.max(0, Math.ceil((startedAt + durationMs - now) / 1_000)) : null;
  return (
    <div className={remaining !== null && remaining < 10 ? 'turn-timer is-low' : 'turn-timer'}>
      <Clock3 />
      {remaining === null ? '∞' : `00:${String(remaining).padStart(2, '0')}`}
    </div>
  );
}

function parseGameState(value: JsonValue | undefined): GameState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    value.schemaVersion !== 1 ||
    typeof value.gameId !== 'string' ||
    typeof value.players !== 'object'
  )
    return null;
  return value as unknown as GameState;
}
