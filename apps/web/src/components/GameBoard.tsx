import type { GameState } from '@circuit/game-engine';
import type { PublicRoomState } from '@circuit/shared';
import { AnimatePresence, motion, useReducedMotion, type MotionStyle } from 'framer-motion';
import {
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Landmark,
  Plane,
  Scale,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
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

type GraphicsPreset = 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH';
const GRAPHICS_KEY = 'atlas:graphics:v1';
const CINEMATIC_KEY = 'atlas:cinematic:v1';

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
  const [graphics, setGraphics] = useState<GraphicsPreset>(() => loadGraphicsPreset());
  const [cinematic, setCinematic] = useState(() => localStorage.getItem(CINEMATIC_KEY) !== 'false');
  const roomByPlayer = useMemo(
    () => new Map(room.players.map((player) => [player.id, player])),
    [room.players]
  );
  const map = useMemo(() => getAtlasMap(state.mapId), [state.mapId]);
  const points = useMemo(
    () => routePointsForMap(state.mapId, map.tiles.length),
    [map.tiles.length, state.mapId]
  );
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const currentTileId = currentId ? state.players[currentId]?.positionTileId : undefined;
  const currentTileIndex = map.tiles.findIndex((tile) => tile.id === currentTileId);
  const effectiveGraphics = resolveGraphicsPreset(graphics);
  const lastRollKey =
    [...state.activity].reverse().find((entry) => entry.type === 'DICE_ROLL')?.id ?? 'initial';
  const hasLastRoll = state.lastRoll !== null;

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

  function updateGraphics(value: GraphicsPreset): void {
    setGraphics(value);
    localStorage.setItem(GRAPHICS_KEY, value);
  }

  function toggleCinematic(): void {
    setCinematic((value) => {
      localStorage.setItem(CINEMATIC_KEY, String(!value));
      return !value;
    });
  }

  return (
    <section
      className={`board-stage world-route-board graphics-${effectiveGraphics.toLowerCase()}${cinematic ? ' is-cinematic' : ''}`}
      aria-label={`${map.config.name} world route board`}
    >
      <motion.img
        className="world-map-art"
        src="/assets/world-route-relief.png"
        alt=""
        draggable={false}
        animate={cinematic && !reduceMotion ? { scale: [1.015, 1.035, 1.015] } : { scale: 1.015 }}
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
          return (
            <path
              className={
                index === (currentTileIndex - 1 + points.length) % points.length
                  ? 'route-segment is-active'
                  : 'route-segment'
              }
              d={curvePath(point, next)}
              key={`route-${index}`}
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
          return (
            <button
              type="button"
              className={`route-node route-node--${property ? 'city' : 'stop'} route-node--${tile.kind.toLowerCase()}${owner ? ' is-owned' : ''}${tile.id === currentTileId ? ' is-current' : ''}${point.x > 82 ? ' is-right-edge' : ''}${point.x < 18 ? ' is-left-edge' : ''}`}
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
                    ? `$${effectivePrice.toLocaleString()}`
                    : tile.kind.replaceAll('_', ' ')}
                </small>
              </span>
              {owner ? <i className="route-owner" style={{ background: owner.color }} /> : null}
            </button>
          );
        })}
      </div>

      <div className="world-route-tokens" aria-label="Player positions">
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
                tokenIndex={tokenIndex}
                reduceMotion={Boolean(reduceMotion)}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="board-view-controls" aria-label="Board view controls">
        <button type="button" onClick={toggleCinematic} aria-pressed={cinematic}>
          {cinematic ? <Eye /> : <EyeOff />}
          <span>{cinematic ? 'Living map' : 'Fixed map'}</span>
        </button>
        <label>
          <span>Graphics</span>
          <select
            value={graphics}
            onChange={(event) => updateGraphics(event.target.value as GraphicsPreset)}
            aria-label="Graphics quality"
          >
            <option value="AUTO">Auto</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => onSelectTile(map.tiles[currentTileIndex] ?? map.tiles[0]!)}
        >
          <Crosshair /> <span>Center player</span>
        </button>
      </div>

      <div className="world-dice-dock">
        <span className="world-dice-dock__label">{map.config.name}</span>
        <div
          className={rolling ? 'dice-pair is-rolling' : 'dice-pair'}
          aria-label={state.lastRoll ? `Last roll ${state.lastRoll.total}` : 'Dice not rolled'}
        >
          <Die value={state.lastRoll?.dice[0] ?? 3} rolling={rolling} side="left" />
          <Die value={state.lastRoll?.dice[1] ?? 5} rolling={rolling} side="right" />
        </div>
        {state.lastRoll ? (
          <p>
            {state.lastRoll.dice[0]} + {state.lastRoll.dice[1]} · {state.lastRoll.total}
          </p>
        ) : (
          <p>Roll to begin your journey</p>
        )}
        {canEndTurn ? (
          <button
            className="button button--secondary board-roll"
            type="button"
            disabled={pending}
            onClick={onEndTurn}
          >
            End turn
          </button>
        ) : (
          <button
            className="button button--primary board-roll"
            type="button"
            disabled={!canRoll || pending || rolling}
            onClick={roll}
          >
            {rolling ? 'Rolling…' : 'Roll dice'}
          </button>
        )}
      </div>
    </section>
  );
}

function RouteToken({
  playerId,
  playerName,
  playerColor,
  positionIndex,
  points,
  tokenIndex,
  reduceMotion
}: {
  playerId: string;
  playerName: string;
  playerColor: string;
  positionIndex: number;
  points: readonly RoutePoint[];
  tokenIndex: number;
  reduceMotion: boolean;
}) {
  const previousIndex = useRef(positionIndex);
  const [path, setPath] = useState<readonly RoutePoint[]>(() => [points[positionIndex]!]);

  useEffect(() => {
    const pathIndexes = movementIndexes(previousIndex.current, positionIndex, points.length);
    setPath(pathIndexes.map((index) => points[index]!));
    previousIndex.current = positionIndex;
  }, [points, positionIndex]);

  return (
    <motion.div
      className="route-token"
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
          duration: reduceMotion ? 0.05 : Math.max(0.8, (path.length - 1) * 0.24),
          ease: 'easeInOut'
        },
        top: {
          duration: reduceMotion ? 0.05 : Math.max(0.8, (path.length - 1) * 0.24),
          ease: 'easeInOut'
        },
        scale: { duration: reduceMotion ? 0.05 : 0.65 }
      }}
      title={playerName}
      aria-label={`${playerName} token`}
      data-player-id={playerId}
    >
      <span className="route-token__head" />
      <span className="route-token__body" />
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

function routePointsForMap(mapId: string, tileCount: number): readonly RoutePoint[] {
  if (mapId === 'neon-city' && tileCount === WORLD_CAPITAL_POINTS.length)
    return WORLD_CAPITAL_POINTS;
  return Array.from({ length: tileCount }, (_, index) => {
    const angle = (index / tileCount) * Math.PI * 2 - Math.PI / 2;
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

function loadGraphicsPreset(): GraphicsPreset {
  const stored = localStorage.getItem(GRAPHICS_KEY);
  return stored === 'LOW' || stored === 'MEDIUM' || stored === 'HIGH' ? stored : 'AUTO';
}

function resolveGraphicsPreset(preset: GraphicsPreset): Exclude<GraphicsPreset, 'AUTO'> {
  if (preset !== 'AUTO') return preset;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (window.matchMedia('(max-width: 760px)').matches || memory <= 2) return 'LOW';
  return memory >= 8 ? 'HIGH' : 'MEDIUM';
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
  const index = Number(group.split('-').at(-1) ?? 0);
  return ['#365f45', '#40627d', '#8c682e', '#7c4a53', '#6f8b6d'][index % 5]!;
}
