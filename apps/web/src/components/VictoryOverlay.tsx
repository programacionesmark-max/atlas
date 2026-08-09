import type { GameState } from '@circuit/game-engine';
import type { MatchRecap, PublicRoomState } from '@circuit/shared';
import { Home, RotateCcw, Share2, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchMatchRecap } from '../lib/matches';
import { MatchRecapPanel } from './MatchRecapPanel';

interface VictoryOverlayProps {
  state: GameState;
  room: PublicRoomState;
  viewerId: string;
  onRematch: () => Promise<void>;
}

export function VictoryOverlay({ state, room, viewerId, onRematch }: VictoryOverlayProps) {
  const navigate = useNavigate();
  const [recap, setRecap] = useState<MatchRecap | null>(null);
  const [pending, setPending] = useState(false);
  const isHost = room.hostPlayerId === viewerId;

  useEffect(() => {
    let active = true;
    void fetchMatchRecap(state.gameId)
      .then((result) => {
        if (active) setRecap(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [state.gameId]);

  const winnerId = state.winnerIds[0];
  const winner = winnerId ? state.players[winnerId] : null;
  const standings = [...Object.values(state.players)].sort((a, b) => {
    if (a.status === 'BANKRUPT' && b.status !== 'BANKRUPT') return 1;
    if (b.status === 'BANKRUPT' && a.status !== 'BANKRUPT') return -1;
    return b.cash - a.cash;
  });

  async function rematch(): Promise<void> {
    setPending(true);
    try {
      await onRematch();
      void navigate(`/room/${room.code}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="modal-backdrop victory-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-title"
    >
      <section className="victory-modal victory-modal--recap">
        {recap ? (
          <MatchRecapPanel recap={recap} />
        ) : (
          <div className="victory-fallback">
            <Trophy className="victory-trophy" />
            <h2 id="victory-title">
              {winner ? `${winner.name} takes the city` : 'Match complete'}
            </h2>
            <p>Saving the full game recap…</p>
            <div className="standings">
              {standings.map((player, index) => (
                <div key={player.id}>
                  <span>#{index + 1}</span>
                  <strong>{player.name}</strong>
                  <em>
                    {player.status === 'BANKRUPT' ? 'Bankrupt' : `$${player.cash.toLocaleString()}`}
                  </em>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="victory-actions victory-actions--recap">
          {isHost ? (
            <button
              className="button button--primary"
              type="button"
              disabled={pending}
              onClick={() => void rematch()}
            >
              <RotateCcw /> {pending ? 'Preparing…' : 'Rematch'}
            </button>
          ) : (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => void navigate(`/room/${room.code}`)}
            >
              <RotateCcw /> Return to group
            </button>
          )}
          <button
            className="button button--outline"
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/match/${state.gameId}`;
              void navigator.clipboard.writeText(url);
            }}
          >
            <Share2 /> Share result
          </button>
          <button className="button button--ghost" type="button" onClick={() => void navigate('/')}>
            <Home /> Home
          </button>
        </div>
      </section>
    </div>
  );
}
