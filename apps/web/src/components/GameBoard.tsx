import type { GameState, MapConfig } from '@circuit/game-engine';
import type { PublicRoomState } from '@circuit/shared';
import { AnimatePresence, motion, useReducedMotion, type MotionStyle } from 'framer-motion';
import { Compass, Hotel, Home, Landmark, Plane, Scale, ShieldAlert, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { getAtlasMap, type VisualTile } from '../data/atlas';

interface GameBoardProps {
  state: GameState;
  room: PublicRoomState;
  onSelectTile: (tile: VisualTile) => void;
  onRoll: () => void;
  onEndTurn: () => void;
  canRoll: boolean;
  canEndTurn: boolean;
  pending: boolean;
}

interface RoutePoint {
  x: number;
  y: number;
}

const WORLD_CAPITAL_POINTS: readonly RoutePoint[] = [
  { x: 42, y: 19 },
  { x: 47, y: 25 },
  { x: 51, y: 28 },
  { x: 49, y: 33 },
  { x: 27, y: 35 },
  { x: 35, y: 32 },
  { x: 40, y: 37 },
  { x: 45, y: 41 },
  { x: 48, y: 44 },
  { x: 52, y: 39 },
  { x: 62, y: 47 },
  { x: 68, y: 49 },
  { x: 53, y: 79 },
  { x: 56, y: 49 },
  { x: 63, y: 59 },
  { x: 76, y: 67 },
  { x: 82, y: 58 },
  { x: 88, y: 39 },
  { x: 88, y: 53 },
  { x: 84, y: 82 },
  { x: 70, y: 78 },
  { x: 35, y: 81 },
  { x: 31, y: 68 },
  { x: 24, y: 61 },
  { x: 24, y: 29 },
  { x: 18, y: 41 },
  { x: 19, y: 54 },
  { x: 34, y: 58 },
  { x: 58, y: 64 },
  { x: 64, y: 58 },
  { x: 68, y: 53 },
  { x: 58, y: 32 }
] as const;

const BRANCH_CONNECTIONS = [
  [1, 24],
  [3, 7],
  [3, 9],
  [4, 24],
  [10, 13],
  [10, 30],
  [12, 13],
  [13, 28],
  [15, 30],
  [15, 17],
  [15, 19],
  [21, 26],
  [28, 12]
] as const;

const GROUP_COLORS: Record<string, string> = {
  magenta: '#5d8f73',
  transit: '#5e8ca1',
  cyan: '#6f8b6d',
  entertainment: '#b85f3f',
  amber: '#c49045',
  finance: '#4f8878',
  violet: '#80639c'
};

const COUNTRY_COLORS = [
  '#53a06e',
  '#5d8db7',
  '#c68a3d',
  '#b45d68',
  '#8b72b8',
  '#4fa4a6',
  '#c36d46'
] as const;

export function GameBoard({
  state,
  room,
  onSelectTile,
  onRoll,
  onEndTurn,
  canRoll,
  canEndTurn,
  pending
}: GameBoardProps) {
  const reduceMotion = useReducedMotion();
  const [rolling, setRolling] = useState(false);
  const roomByPlayer = useMemo(
    () => new Map(room.players.map((player) => [player.id, player])),
    [room.players]
  );
  const map = useMemo(() => getAtlasMap(state.mapId), [state.mapId]);
  const points = useMemo(() => routePointsForMap(map.config), [map.config]);
  const tileIndexById = useMemo(
    () => new Map(map.tiles.map((tile, index) => [tile.id, index])),
    [map.tiles]
  );
  const countryGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const property of map.config.properties) {
      const current = groups.get(property.group) ?? [];
      current.push(property.id);
      groups.set(property.group, current);
    }
    return groups;
  }, [map.config.properties]);
  const flightConnections = useMemo(
    () =>
      map.config.tiles.flatMap((tile) =>
        (tile.flightOptions ?? []).flatMap((option) => {
          const from = tileIndexById.get(tile.id);
          const to = tileIndexById.get(option.destinationTileId);
          return from === undefined || to === undefined ? [] : [{ from, to, fee: option.fee }];
        })
      ),
    [map.config.tiles, tileIndexById]
  );
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const currentTileId = currentId ? state.players[currentId]?.positionTileId : undefined;
  const currentTileIndex = map.tiles.findIndex((tile) => tile.id === currentTileId);
  const lastRollKey =
    [...state.activity].reverse().find((entry) => entry.type === 'DICE_ROLL')?.id ?? 'initial';
  const hasLastRoll = state.lastRoll !== null;
  const turnStep = phaseStep(state.phase);
  const coach = phaseCoach(state.phase, canRoll, canEndTurn);

  useEffect(() => {
    if (!hasLastRoll) return;
    setRolling(true);
    const timeout = window.setTimeout(() => setRolling(false), reduceMotion ? 80 : 950);
    return () => window.clearTimeout(timeout);
  }, [hasLastRoll, lastRollKey, reduceMotion]);

  function roll(): void {
    setRolling(true);
    onRoll();
  }

  return (
    <section
      className={`board-stage world-route-board simple-world-board graphics-medium is-cinematic${map.tiles.length >= 40 ? ' is-dense' : ''}`}
      aria-label={`Tablero mundial ${map.config.name}`}
    >
      <motion.img
        className="world-map-art"
        src="/assets/world-route-relief-v2.webp"
        alt=""
        draggable={false}
        animate={!reduceMotion ? { scale: [1.002, 1.01, 1.002] } : { scale: 1.002 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="world-map-depth" aria-hidden="true" />

      <svg
        className="world-route-lines"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="route-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="0.45" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {points.map((point, index) => {
          const next = points[(index + 1) % points.length]!;
          const tile = map.tiles[index];
          const nextTile = map.tiles[(index + 1) % map.tiles.length];
          const countryRoute =
            tile?.group && tile.group === nextTile?.group ? groupColor(tile.group) : null;
          return (
            <path
              className={`${index === (currentTileIndex - 1 + points.length) % points.length ? 'route-segment is-active' : 'route-segment'}${countryRoute ? ' is-country-route' : ''}`}
              d={curvePath(point, next)}
              key={`route-${index}`}
              style={
                countryRoute
                  ? ({ '--route-country-color': countryRoute } as CSSProperties)
                  : undefined
              }
            />
          );
        })}
        {state.mapId === 'neon-city'
          ? BRANCH_CONNECTIONS.map(([from, to]) => (
              <path
                className="route-branch"
                d={curvePath(points[from]!, points[to]!, true)}
                key={`branch-${from}-${to}`}
              />
            ))
          : null}
        {flightConnections.map(({ from, to, fee }) => (
          <path
            className="route-branch route-branch--flight"
            d={curvePath(points[from]!, points[to]!, true)}
            data-fee={fee}
            key={`flight-${from}-${to}`}
          />
        ))}
      </svg>

      <div className="world-route-nodes">
        {map.tiles.map((tile, index) => {
          const point = points[index]!;
          const propertyState = state.properties[tile.id];
          const owner = propertyState?.ownerId
            ? roomByPlayer.get(propertyState.ownerId)
            : undefined;
          const effectivePrice = tile.price
            ? Math.round(tile.price * state.rules.propertyPriceMultiplier)
            : undefined;
          const property = tile.kind === 'PROPERTY';
          const propertyConfig = map.properties.get(tile.id);
          const countryPropertyIds = propertyConfig
            ? (countryGroups.get(propertyConfig.group) ?? [])
            : [];
          const countryComplete = Boolean(
            owner &&
            countryPropertyIds.length > 1 &&
            countryPropertyIds.every(
              (propertyId) => state.properties[propertyId]?.ownerId === propertyState?.ownerId
            )
          );
          const countryAnchor = countryPropertyIds[0] === tile.id;
          const upgradeLevel = propertyState?.upgradeLevel ?? 0;
          return (
            <button
              type="button"
              className={`route-node route-node--${property ? 'city' : 'stop'} route-node--${tile.kind.toLowerCase()}${owner ? ' is-owned' : ''}${countryAnchor ? ' is-country-anchor' : ''}${countryComplete ? ' is-complete-country' : ''}${upgradeLevel ? ' is-developed' : ''}${tile.id === currentTileId ? ' is-current' : ''}${point.x > 82 ? ' is-right-edge' : ''}${point.x < 18 ? ' is-left-edge' : ''}`}
              key={tile.id}
              style={
                {
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  '--group-color': tile.group ? groupColor(tile.group) : '#c49a50',
                  '--owner-color': owner?.color ?? '#c49a50'
                } as CSSProperties
              }
              onClick={() => onSelectTile(tile)}
              aria-label={`${tile.name}${effectivePrice ? `, $${effectivePrice}` : `, ${tile.kind.replaceAll('_', ' ')}`}`}
            >
              <span className="route-node__pin">{tileIcon(tile.kind)}</span>
              <span className="route-node__label">
                <strong>{tile.name}</strong>
                <small>
                  {effectivePrice
                    ? `${tile.region ? `${tile.region} · ` : ''}$${effectivePrice.toLocaleString()}`
                    : tile.kind.replaceAll('_', ' ')}
                </small>
              </span>
              {owner ? <i className="route-owner" style={{ background: owner.color }} /> : null}
              {upgradeLevel ? <DevelopmentMiniature level={upgradeLevel} /> : null}
            </button>
          );
        })}
      </div>

      <div className="world-route-tokens" aria-label="Posiciones de jugadores">
        <AnimatePresence>
          {Object.values(state.players).map((player, tokenIndex) => {
            const positionIndex = map.tiles.findIndex((tile) => tile.id === player.positionTileId);
            return (
              <RouteToken
                key={player.id}
                playerId={player.id}
                playerName={player.name}
                playerColor={roomByPlayer.get(player.id)?.color ?? '#f2efe8'}
                positionIndex={Math.max(0, positionIndex)}
                points={points}
                tileIndexById={tileIndexById}
                movementId={
                  state.lastMovement?.playerId === player.id ? state.lastMovement.id : null
                }
                movementTileIds={
                  state.lastMovement?.playerId === player.id
                    ? state.lastMovement.tileIds
                    : undefined
                }
                movementMode={
                  state.lastMovement?.playerId === player.id ? state.lastMovement.mode : 'GROUND'
                }
                tokenIndex={tokenIndex}
                reduceMotion={Boolean(reduceMotion)}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="world-dice-dock">
        <span className="world-dice-dock__label">Tu jugada</span>
        <div
          className={rolling ? 'dice-pair is-rolling' : 'dice-pair'}
          aria-label={state.lastRoll ? `Última tirada ${state.lastRoll.total}` : 'Dados sin tirar'}
        >
          <Die value={state.lastRoll?.dice[0] ?? 3} rolling={rolling} side="left" />
          <Die value={state.lastRoll?.dice[1] ?? 5} rolling={rolling} side="right" />
        </div>
        <p className="world-dice-dock__result">
          {state.lastRoll ? `Resultado: ${state.lastRoll.total}` : 'Dados preparados'}
        </p>
        {canEndTurn ? (
          <button
            className="button button--secondary board-roll"
            type="button"
            disabled={pending}
            onClick={onEndTurn}
          >
            Finalizar turno
          </button>
        ) : (
          <button
            className="button button--primary board-roll"
            type="button"
            disabled={!canRoll || pending || rolling}
            onClick={roll}
          >
            {rolling
              ? 'Tirando…'
              : canRoll
                ? 'Tirar dados'
                : pending
                  ? 'Sincronizando…'
                  : 'Espera tu turno'}
          </button>
        )}
        <span className="world-dice-dock__coach" role="status" aria-live="polite">
          {coach}
        </span>
      </div>
      <div className="monopoly-help-strip turn-progress" aria-label="Progreso del turno">
        {['Tirar', 'Mover', 'Resolver'].map((label, index) => {
          const step = index + 1;
          return (
            <span
              className={step === turnStep ? 'is-active' : step < turnStep ? 'is-complete' : ''}
              key={label}
            >
              <b>{step}</b> {label}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function DevelopmentMiniature({ level }: { level: number }) {
  const Icon = level >= 5 ? Hotel : Home;
  return (
    <span
      className={`route-node__development level-${Math.min(level, 4)}`}
      aria-label={`${level} mejoras: ${developmentLabel(level)}`}
    >
      <Icon />
      <i />
    </span>
  );
}

function developmentLabel(level: number): string {
  if (level >= 5) return 'hotel';
  return `${level} ${level === 1 ? 'casa' : 'casas'}`;
}

function RouteToken({
  playerId,
  playerName,
  playerColor,
  positionIndex,
  points,
  tileIndexById,
  movementId,
  movementTileIds,
  movementMode,
  tokenIndex,
  reduceMotion
}: {
  playerId: string;
  playerName: string;
  playerColor: string;
  positionIndex: number;
  points: readonly RoutePoint[];
  tileIndexById: ReadonlyMap<string, number>;
  movementId: string | null;
  movementTileIds: readonly string[] | undefined;
  movementMode: 'GROUND' | 'FLIGHT';
  tokenIndex: number;
  reduceMotion: boolean;
}) {
  const previousIndex = useRef(positionIndex);
  const [path, setPath] = useState<readonly RoutePoint[]>(() => [points[positionIndex]!]);

  useEffect(() => {
    const tracedIndexes = movementTileIds?.flatMap((tileId) => {
      const index = tileIndexById.get(tileId);
      return index === undefined ? [] : [index];
    });
    const pathIndexes =
      tracedIndexes?.length && tracedIndexes.at(-1) === positionIndex
        ? tracedIndexes
        : movementIndexes(previousIndex.current, positionIndex, points.length);
    setPath(pathIndexes.map((index) => points[index]!));
    previousIndex.current = positionIndex;
  }, [movementId, movementTileIds, points, positionIndex, tileIndexById]);

  return (
    <motion.div
      className={`route-token${path.length > 1 ? ' is-moving' : ''}${movementMode === 'FLIGHT' ? ' is-flying' : ''}`}
      style={
        {
          color: playerColor,
          zIndex: 70 + tokenIndex,
          '--token-offset-x': `${(tokenIndex % 3) * 9 - 9}px`,
          '--token-offset-y': `${Math.floor(tokenIndex / 3) * 7}px`
        } as MotionStyle
      }
      initial={{
        left: `${points[positionIndex]!.x}%`,
        top: `${points[positionIndex]!.y}%`,
        scale: 0.7
      }}
      animate={{
        left: path.map((point) => `${point.x}%`),
        top: path.map((point) => `${point.y}%`),
        scale: reduceMotion ? 1 : [1, 1.14, 1]
      }}
      transition={{
        left: {
          delay: reduceMotion ? 0 : 0.72,
          duration: reduceMotion ? 0.05 : Math.max(1.05, (path.length - 1) * 0.38),
          ease: 'easeInOut'
        },
        top: {
          delay: reduceMotion ? 0 : 0.72,
          duration: reduceMotion ? 0.05 : Math.max(1.05, (path.length - 1) * 0.38),
          ease: 'easeInOut'
        },
        scale: { duration: reduceMotion ? 0.05 : 0.65 }
      }}
      title={playerName}
      aria-label={`Ficha de ${playerName}`}
      data-player-id={playerId}
    >
      <span className="route-token__head" />
      <span className="route-token__body" />
      {movementMode === 'FLIGHT' ? <Plane className="route-token__plane" /> : null}
      <span className="route-token__shadow" />
    </motion.div>
  );
}

function Die({
  value,
  rolling,
  side
}: {
  value: number;
  rolling: boolean;
  side: 'left' | 'right';
}) {
  return (
    <motion.span
      className="die"
      data-value={value}
      animate={
        rolling
          ? {
              rotateX: side === 'left' ? [0, 210, 390, 720] : [0, -190, -430, -720],
              rotateY: side === 'left' ? [0, -170, 260, 540] : [0, 230, -180, -540],
              y: [0, -22, -7, 0],
              scale: [1, 0.82, 1.08, 1]
            }
          : { rotateX: 8, rotateY: side === 'left' ? -9 : 9, y: 0, scale: 1 }
      }
      transition={{ duration: 0.9, ease: [0.18, 0.8, 0.25, 1] }}
    >
      {Array.from({ length: value }, (_, index) => (
        <i key={index} />
      ))}
    </motion.span>
  );
}

function movementIndexes(from: number, to: number, length: number): number[] {
  if (from === to) return [to];
  const forwardSteps = (to - from + length) % length;
  if (forwardSteps > 12) return [from, to];
  return Array.from({ length: forwardSteps + 1 }, (_, step) => (from + step) % length);
}

function routePointsForMap(config: MapConfig): readonly RoutePoint[] {
  if (config.tiles.every((tile) => tile.mapPosition))
    return config.tiles.map((tile) => tile.mapPosition as RoutePoint);
  if (config.id === 'neon-city' && config.tiles.length === WORLD_CAPITAL_POINTS.length)
    return WORLD_CAPITAL_POINTS;
  return Array.from({ length: config.tiles.length }, (_, index) => {
    const angle = (index / config.tiles.length) * Math.PI * 2 - Math.PI / 2;
    const radiusX = 35 + Math.sin(index * 1.7) * 4;
    const radiusY = 30 + Math.cos(index * 1.3) * 5;
    return { x: 50 + Math.cos(angle) * radiusX, y: 52 + Math.sin(angle) * radiusY };
  });
}

function curvePath(from: RoutePoint, to: RoutePoint, branch = false): string {
  const dx = to.x - from.x;
  const lift = Math.min(9, Math.abs(dx) * 0.14 + (branch ? 3.5 : 1.5));
  const controlX = (from.x + to.x) / 2;
  const controlY = (from.y + to.y) / 2 - lift;
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}

function tileIcon(kind: VisualTile['kind']) {
  switch (kind) {
    case 'START':
      return <Compass />;
    case 'EVENT':
      return <Sparkles />;
    case 'TAX':
      return <Scale />;
    case 'JAIL':
    case 'GO_TO_JAIL':
      return <ShieldAlert />;
    case 'TELEPORT':
      return <Plane />;
    default:
      return <Landmark />;
  }
}

function groupColor(group: string): string {
  if (GROUP_COLORS[group]) return GROUP_COLORS[group];
  let hash = 0;
  for (const character of group) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return COUNTRY_COLORS[hash % COUNTRY_COLORS.length]!;
}

function phaseStep(phase: GameState['phase']): number {
  if (phase === 'TURN_START' || phase === 'JAIL' || phase === 'ROLLING') return 1;
  if (phase === 'MOVING' || phase === 'FLIGHT_DECISION') return 2;
  return 3;
}

function phaseCoach(phase: GameState['phase'], canRoll: boolean, canEndTurn: boolean): string {
  if (canRoll) return 'Lanza los dados para avanzar por tu ruta.';
  if (canEndTurn) return 'Jugada resuelta. Termina el turno cuando estés listo.';
  switch (phase) {
    case 'ROLLING':
      return 'Los dados están decidiendo tu recorrido.';
    case 'MOVING':
      return 'Tu ficha avanza casilla a casilla.';
    case 'FLIGHT_DECISION':
      return 'Elige si vuelas o continúas por tierra.';
    case 'PROPERTY_DECISION':
      return 'Decide si compras la ciudad o la subastas.';
    case 'PAYMENT':
      return 'Resuelve el pago pendiente para continuar.';
    case 'ROUND_EVENT':
      return 'La Cámara del Atlas tiene una sorpresa.';
    case 'AUCTION':
      return 'La ciudad está en subasta. Haz tu oferta.';
    default:
      return 'Sigue la acción iluminada en pantalla.';
  }
}
