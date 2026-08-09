import type { GameState } from '@circuit/game-engine';
import type { PublicRoomState } from '@circuit/shared';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

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

type GraphicsPreset = 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH';
const GRAPHICS_KEY = 'atlas:graphics:v1';
const CINEMATIC_KEY = 'atlas:cinematic:v1';

const GROUP_COLORS: Record<string, string> = {
  magenta: '#365f45',
  transit: '#40627d',
  cyan: '#6f8b6d',
  entertainment: '#b85f3f',
  amber: '#c49045',
  finance: '#497364',
  violet: '#7c4a53'
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
  const playerList = Object.values(state.players);
  const roomByPlayer = useMemo(
    () => new Map(room.players.map((player) => [player.id, player])),
    [room.players]
  );
  const map = useMemo(() => getAtlasMap(state.mapId), [state.mapId]);
  const side = map.tiles.length / 4 + 1;
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const currentTileId = currentId ? state.players[currentId]?.positionTileId : undefined;
  const currentTileIndex = map.tiles.findIndex((tile) => tile.id === currentTileId);
  const effectiveGraphics = resolveGraphicsPreset(graphics);
  const camera = cinematic && !reduceMotion ? cameraOffset(currentTileIndex, map.tiles.length) : {};

  useEffect(() => {
    if (!rolling) return;
    const timeout = window.setTimeout(() => setRolling(false), 750);
    return () => window.clearTimeout(timeout);
  }, [rolling]);

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
      className={`board-stage board-stage--diorama graphics-${effectiveGraphics.toLowerCase()}`}
      aria-label={`${map.config.name} living city board`}
    >
      <div className="board-view-controls" aria-label="Board view controls">
        <button type="button" onClick={toggleCinematic} aria-pressed={cinematic}>
          {cinematic ? <Eye /> : <EyeOff />}
          <span>{cinematic ? 'Camera on' : 'Camera fixed'}</span>
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

      <motion.div
        className="board-camera"
        animate={camera}
        transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <img className="board-art" src={map.image} alt="" draggable={false} />
        <div className="city-ambience" aria-hidden="true">
          <i className="ambient-vehicle ambient-vehicle--one" />
          <i className="ambient-vehicle ambient-vehicle--two" />
          <i className="ambient-boat" />
          <i className="ambient-water" />
        </div>
        <div className="board-grid" style={{ '--board-side': side } as CSSProperties}>
          {map.tiles.map((tile, index) => {
            const propertyState = state.properties[tile.id];
            const owner = propertyState?.ownerId
              ? roomByPlayer.get(propertyState.ownerId)
              : undefined;
            const playersHere = playerList.filter((player) => player.positionTileId === tile.id);
            const effectivePrice = tile.price
              ? Math.round(tile.price * state.rules.propertyPriceMultiplier)
              : undefined;
            return (
              <button
                type="button"
                className={`board-tile board-tile--${tile.kind.toLowerCase()}${owner ? ' is-owned' : ''}${tile.id === currentTileId ? ' is-current' : ''}`}
                key={tile.id}
                style={
                  {
                    ...gridPosition(index, map.tiles.length),
                    '--group-color': tile.group ? groupColor(tile.group) : '#8b765d',
                    '--owner-color': owner?.color ?? '#8b765d'
                  } as CSSProperties
                }
                onClick={() => onSelectTile(tile)}
              >
                <span
                  className="tile-group"
                  style={owner ? { background: owner.color } : undefined}
                />
                {owner ? (
                  <span className="property-building" aria-hidden="true">
                    {Array.from(
                      { length: Math.max(1, (propertyState?.upgradeLevel ?? 0) + 1) },
                      (_, building) => (
                        <i key={building} />
                      )
                    )}
                  </span>
                ) : null}
                <span className="tile-icon">{tileIcon(tile.kind)}</span>
                <strong>{tile.name}</strong>
                {effectivePrice ? (
                  <small>${effectivePrice.toLocaleString()}</small>
                ) : (
                  <small>{tile.kind.replaceAll('_', ' ')}</small>
                )}
                <span className="tile-tokens">
                  <AnimatePresence>
                    {playersHere.map((player, tokenIndex) => (
                      <motion.i
                        layoutId={`token-${player.id}`}
                        key={player.id}
                        className="mini-token"
                        style={{
                          color: roomByPlayer.get(player.id)?.color ?? '#f2efe8',
                          zIndex: tokenIndex + 1
                        }}
                        title={player.name}
                        transition={{
                          type: 'spring',
                          stiffness: reduceMotion ? 1000 : 210,
                          damping: reduceMotion ? 100 : 24
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </span>
              </button>
            );
          })}
          <div
            className="board-center"
            style={{ gridColumn: `2 / ${side}`, gridRow: `2 / ${side}` }}
          >
            <span className="board-route">{map.config.name}</span>
            <span className="board-name">Atlas Estates</span>
            <div
              className={rolling ? 'dice-pair is-rolling' : 'dice-pair'}
              aria-label={state.lastRoll ? `Last roll ${state.lastRoll.total}` : 'Dice not rolled'}
            >
              <Die value={state.lastRoll?.dice[0] ?? 3} />
              <Die value={state.lastRoll?.dice[1] ?? 5} />
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
        </div>
      </motion.div>
    </section>
  );
}

function Die({ value }: { value: number }) {
  return (
    <span className="die" data-value={value}>
      {Array.from({ length: value }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
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

function cameraOffset(index: number, tileCount: number) {
  if (index < 0) return { scale: 1, x: '0%', y: '0%' };
  const quarter = tileCount / 4;
  const side = Math.floor(index / quarter);
  return (
    [
      { scale: 1.018, x: '0%', y: '0.7%' },
      { scale: 1.018, x: '-0.7%', y: '0%' },
      { scale: 1.018, x: '0%', y: '-0.7%' },
      { scale: 1.018, x: '0.7%', y: '0%' }
    ][side] ?? { scale: 1, x: '0%', y: '0%' }
  );
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
    case 'MARKET':
      return <Landmark />;
    default:
      return null;
  }
}

function gridPosition(index: number, tileCount = 32): CSSProperties {
  const side = tileCount / 4 + 1;
  if (index < side) return { gridColumn: index + 1, gridRow: 1 };
  if (index < side * 2 - 1) return { gridColumn: side, gridRow: index - side + 2 };
  if (index < side * 3 - 2) return { gridColumn: side * 3 - 2 - index, gridRow: side };
  return { gridColumn: 1, gridRow: side * 4 - 3 - index };
}

function groupColor(group: string): string {
  if (GROUP_COLORS[group]) return GROUP_COLORS[group];
  const index = Number(group.split('-').at(-1) ?? 0);
  return ['#365f45', '#40627d', '#8c682e', '#7c4a53', '#6f8b6d'][index % 5]!;
}
