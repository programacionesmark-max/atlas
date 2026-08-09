import type { MatchRecap } from '@circuit/shared';
import { Crown, Sparkles, Trophy } from 'lucide-react';

export function MatchRecapPanel({ recap }: { recap: MatchRecap }) {
  const winner = recap.players.find((player) => recap.winnerPlayerIds.includes(player.playerId));
  return (
    <div className="match-recap">
      <header className="match-recap__hero">
        <Trophy aria-hidden="true" />
        <div>
          <span className="section-label">Game recap · {recap.matchId.slice(0, 8)}</span>
          <h1>{winner ? `${winner.nickname} takes the city` : 'Match complete'}</h1>
          <p>
            {recap.roundsPlayed} rounds · {formatDuration(recap.durationMs)} ·{' '}
            {recap.victoryReason.toLowerCase().replaceAll('_', ' ')}
          </p>
        </div>
      </header>

      <section className="recap-standings" aria-labelledby="standings-title">
        <h2 id="standings-title">Final standings</h2>
        {recap.players.map((player) => (
          <article key={player.playerId} className={player.placement === 1 ? 'is-winner' : ''}>
            <span className="recap-place">#{player.placement}</span>
            <div>
              <strong>
                {player.nickname} {player.placement === 1 ? <Crown aria-label="Winner" /> : null}
              </strong>
              <small>{player.status === 'BANKRUPT' ? 'Bankrupt' : 'Finished'}</small>
            </div>
            <dl>
              <div>
                <dt>Net worth</dt>
                <dd>${player.netWorth.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Cash</dt>
                <dd>${player.finalCash.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Properties</dt>
                <dd>{player.propertiesOwned}</dd>
              </div>
              <div>
                <dt>Rent earned</dt>
                <dd>${player.rentEarned.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Trades</dt>
                <dd>{player.tradesCompleted}</dd>
              </div>
              <div>
                <dt>Average roll</dt>
                <dd>{player.averageRoll || '—'}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="recap-awards" aria-labelledby="awards-title">
        <h2 id="awards-title">Match awards</h2>
        <div>
          {recap.awards.map((award, index) => {
            const player = recap.players.find((item) => item.playerId === award.playerId);
            return (
              <article key={`${award.id}-${index}`}>
                <Sparkles aria-hidden="true" />
                <strong>{award.label}</strong>
                <span>{player?.nickname ?? 'Player'}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="recap-highlights" aria-labelledby="highlights-title">
        <h2 id="highlights-title">Match highlights</h2>
        <ol>
          {recap.highlights.map((highlight) => (
            <li key={highlight.id}>
              <span>Round {highlight.round}</span>
              <p>{highlight.message}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function formatDuration(durationMs: number): string {
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
