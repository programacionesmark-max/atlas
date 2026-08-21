import type { GameState } from '@circuit/game-engine';
import type { JsonValue } from '@circuit/shared';
import {
  ArrowLeftRight,
  Banknote,
  Clock3,
  Flag,
  Handshake,
  Landmark,
  Menu,
  MessageCircle,
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
import { EmpireModal } from '../components/EmpireModal';
import { GameBoard } from '../components/GameBoard';
import { GameMenuModal } from '../components/GameMenuModal';
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
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [showEmpire, setShowEmpire] = useState(false);
  const [showDesktopChat, setShowDesktopChat] = useState(false);
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
      setActionError(error instanceof Error ? error.message : 'El servidor rechazó la acción.');
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
        <p>Recuperando la partida multijugador…</p>
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
  const eventActivity = state.activity.slice(-4);
  const openTrade = Object.values(state.trades).some(
    (trade) => trade.status === 'OPEN' && trade.recipientId === identity.playerId
  );
  const visibleRoundEvent =
    state.pendingRoundEvent ??
    (state.lastRoundEvent?.id !== dismissedRoundEventId ? state.lastRoundEvent : null);

  return (
    <ScreenTransition className="game-screen simple-game final-game">
      <header className="game-topbar">
        <span hidden data-state-version={wrapped.version}>
          Sincronización #{wrapped.version}
        </span>
        <Brand compact />
        <div className="turn-heading">
          <strong>{isMyTurn ? 'Tu turno' : `Turno de ${current?.name ?? '—'}`}</strong>
          <span>
            Ronda {state.round}
            {state.rules.maxRounds ? ` de ${state.rules.maxRounds}` : ''}
          </span>
        </div>
        <div className="game-top-actions" aria-label="Acciones secundarias">
          <button
            type="button"
            onClick={() => setShowTrade(true)}
            disabled={!room.settings.rules.tradesEnabled}
            aria-label="Intercambiar con jugadores"
          >
            <ArrowLeftRight /> <span>Intercambiar</span>
            {openTrade ? <i>!</i> : null}
          </button>
          <button type="button" onClick={() => setShowEmpire(true)} aria-label="Abrir mi imperio">
            <Landmark /> <span>Mi imperio</span>
          </button>
        </div>
        <TurnTimer startedAt={state.turnStartedAt} durationMs={state.rules.turnTimeMs} />
        <button
          className="icon-button"
          type="button"
          onClick={() => setShowGameMenu(true)}
          aria-label="Menú de partida"
        >
          <Menu />
        </button>
      </header>

      {actionError ? (
        <div className="action-error" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError(null)}>
            Cerrar
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
          {state.paymentDue?.debtorId === identity.playerId || canEnd ? (
            <div className="turn-actions game-action-dock">
              {state.paymentDue?.debtorId === identity.playerId ? (
                <>
                  <button
                    className="button button--ready"
                    type="button"
                    disabled={pending}
                    onClick={() => void action('SETTLE_DEBT', {})}
                  >
                    <Banknote /> Pagar deuda
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
                  Finalizar turno
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <section className="activity-panel">
          <span className="section-label">Actividad reciente</span>
          <div>
            {eventActivity.length ? (
              eventActivity.map((entry) => <p key={entry.id}>{localizeActivity(entry.message)}</p>)
            ) : (
              <p>La partida ha comenzado. El banco está listo.</p>
            )}
          </div>
        </section>
        <section
          className={`${mobilePanel === 'chat' ? 'game-chat mobile-drawer is-open' : 'game-chat'}${showDesktopChat ? ' is-desktop-open' : ''}`}
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
            <button type="submit" disabled={!message.trim()} aria-label="Enviar mensaje">
              <Send />
            </button>
          </form>
        </section>
        <button
          className="corner-menu-button empire-trigger"
          type="button"
          onClick={() => setShowEmpire(true)}
        >
          <Landmark /> Mi imperio
        </button>
        <button
          className={`corner-menu-button chat-trigger${showDesktopChat ? ' is-open' : ''}`}
          type="button"
          onClick={() => setShowDesktopChat((value) => !value)}
        >
          <MessageCircle /> {showDesktopChat ? 'Cerrar chat' : 'Chat'}
          {chat.length ? <i>{Math.min(chat.length, 9)}</i> : null}
        </button>
      </div>

      <nav className="mobile-game-nav" aria-label="Paneles de partida">
        <button
          type="button"
          className={mobilePanel === 'players' ? 'is-active' : ''}
          onClick={() => setMobilePanel('players')}
        >
          <UsersRound />
          Jugadores
        </button>
        <button
          type="button"
          className={mobilePanel === 'board' ? 'is-active' : ''}
          onClick={() => setMobilePanel('board')}
        >
          <span className="nav-board-icon" />
          Tablero
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
          Acciones
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
      {showGameMenu ? (
        <GameMenuModal
          roomCode={room.code}
          tradesEnabled={room.settings.rules.tradesEnabled}
          onClose={() => setShowGameMenu(false)}
          onOpenEmpire={() => {
            setShowGameMenu(false);
            setShowEmpire(true);
          }}
          onOpenTrade={() => {
            setShowGameMenu(false);
            setShowTrade(true);
          }}
          onBankruptcy={() => {
            setShowGameMenu(false);
            setShowBankruptcy(true);
          }}
        />
      ) : null}
      {showEmpire ? (
        <EmpireModal
          state={state}
          viewerId={identity.playerId}
          onClose={() => setShowEmpire(false)}
          onSelectProperty={(tile) => {
            setSelectedTile(tile);
            setMobilePanel('actions');
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

function localizeActivity(message: string): string {
  if (message === 'The game started') return 'La partida ha comenzado';
  return message
    .replace(/^(.+) rolled (\d+)$/, '$1 sacó $2')
    .replace(/^(.+) landed on (.+)$/, '$1 cayó en $2')
    .replace(/^(.+) reached (.+)$/, '$1 llegó a $2')
    .replace(/^(.+) continued by land$/, '$1 continuó por tierra')
    .replace(/^(.+) bought (.+) for \$(\d+)$/, '$1 compró $2 por $$$3')
    .replace(/^(.+) paid \$(\d+) to (.+)$/, '$1 pagó $$$2 a $3')
    .replace(/^Auction started for (.+)$/, 'Subasta iniciada por $1')
    .replace(
      /^Ronda (\d+): (.+) abre la Cámara del Atlas$/,
      'Ronda $1: $2 roba una carta de suerte'
    );
}
