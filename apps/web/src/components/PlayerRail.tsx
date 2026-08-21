import type { GameState } from '@circuit/game-engine';
import type { PublicRoomState } from '@circuit/shared';
import { Crown, Landmark } from 'lucide-react';
import { useMemo } from 'react';

import { getAtlasMap } from '../data/atlas';
import { PlayerAvatar } from './PlayerAvatar';

export function PlayerRail({ state, room }: { state: GameState; room: PublicRoomState }) {
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const roomById = useMemo(
    () => new Map(room.players.map((player) => [player.id, player])),
    [room.players]
  );
  const portfolioByPlayer = useMemo(() => {
    const result = new Map<string, { cities: number; countries: number }>();
    const groups = new Map<string, string[]>();
    for (const property of getAtlasMap(state.mapId).config.properties) {
      const current = groups.get(property.group) ?? [];
      current.push(property.id);
      groups.set(property.group, current);
      const ownerId = state.properties[property.id]?.ownerId;
      if (ownerId) {
        const currentStats = result.get(ownerId) ?? { cities: 0, countries: 0 };
        result.set(ownerId, { ...currentStats, cities: currentStats.cities + 1 });
      }
    }
    for (const propertyIds of groups.values()) {
      const ownerId = state.properties[propertyIds[0]!]?.ownerId;
      if (!ownerId || !propertyIds.every((id) => state.properties[id]?.ownerId === ownerId))
        continue;
      const currentStats = result.get(ownerId) ?? { cities: 0, countries: 0 };
      result.set(ownerId, { ...currentStats, countries: currentStats.countries + 1 });
    }
    return result;
  }, [state.mapId, state.properties]);
  return (
    <aside className="player-rail">
      <span className="section-label">Jugadores</span>
      {state.turnOrder.map((playerId, index) => {
        const player = state.players[playerId];
        if (!player) return null;
        const roomPlayer = roomById.get(playerId);
        const portfolio = portfolioByPlayer.get(playerId) ?? { cities: 0, countries: 0 };
        return (
          <div
            className={
              playerId === currentId
                ? 'rail-player is-current'
                : `rail-player is-${player.status.toLowerCase()}`
            }
            key={playerId}
          >
            <span className="player-number">{index + 1}</span>
            <PlayerAvatar name={player.name} color={roomPlayer?.color ?? '#7c5cff'} />
            <div>
              <strong>
                {player.name}
                {roomPlayer?.isHost ? <Crown /> : null}
              </strong>
              <span className={player.cash < 0 ? 'money-negative' : 'money-positive'}>
                ${player.cash.toLocaleString()}
              </span>
              <small>
                <Landmark /> {portfolio.cities} ciudades · {portfolio.countries} países
              </small>
              <span
                className="rail-country-progress"
                aria-label={`${portfolio.countries} países completos`}
              >
                {Array.from({ length: 5 }, (_, dot) => (
                  <i className={dot < portfolio.countries ? 'is-complete' : ''} key={dot} />
                ))}
              </span>
            </div>
            {!roomPlayer?.connected ? <em>Desconectado</em> : null}
          </div>
        );
      })}
    </aside>
  );
}
