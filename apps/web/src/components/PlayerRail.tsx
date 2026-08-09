import type { GameState } from '@circuit/game-engine';
import type { PublicRoomState } from '@circuit/shared';
import { Crown, Landmark } from 'lucide-react';

import { PlayerAvatar } from './PlayerAvatar';

export function PlayerRail({ state, room }: { state: GameState; room: PublicRoomState }) {
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const roomById = new Map(room.players.map((player) => [player.id, player]));

  return (
    <aside className="player-rail">
      <span className="section-label">Players</span>
      {state.turnOrder.map((playerId, index) => {
        const player = state.players[playerId];
        if (!player) return null;
        const roomPlayer = roomById.get(playerId);
        const owned = Object.values(state.properties).filter(
          (property) => property.ownerId === playerId
        ).length;
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
                <Landmark /> {owned} properties
              </small>
            </div>
            {!roomPlayer?.connected ? <em>Offline</em> : null}
          </div>
        );
      })}
    </aside>
  );
}
