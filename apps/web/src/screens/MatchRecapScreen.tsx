import type { MatchRecap } from '@circuit/shared';
import { ArrowLeft, LoaderCircle, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { MatchRecapPanel } from '../components/MatchRecapPanel';
import { PageShell } from '../components/PageShell';
import { fetchMatchRecap } from '../lib/matches';

export function MatchRecapScreen() {
  const { gameId = '' } = useParams();
  const [recap, setRecap] = useState<MatchRecap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMatchRecap(gameId)
      .then((result) => {
        if (active) setRecap(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load recap.');
      });
    return () => {
      active = false;
    };
  }, [gameId]);

  return (
    <PageShell>
      <main className="match-recap-screen">
        {!recap && !error ? (
          <div className="centered-status">
            <LoaderCircle className="spin-slow" />
            <p>Restoring match recap…</p>
          </div>
        ) : null}
        {error ? (
          <div className="recap-error" role="alert">
            <h1>Recap unavailable</h1>
            <p>{error}</p>
            <Link className="button button--primary" to="/">
              <ArrowLeft /> Return home
            </Link>
          </div>
        ) : null}
        {recap ? (
          <>
            <MatchRecapPanel recap={recap} />
            <nav className="recap-page-actions" aria-label="Match recap actions">
              <Link className="button button--ghost" to="/">
                <ArrowLeft /> Return home
              </Link>
              <button
                className="button button--primary"
                type="button"
                onClick={() => void navigator.clipboard.writeText(window.location.href)}
              >
                <Share2 /> Share result
              </button>
            </nav>
          </>
        ) : null}
      </main>
    </PageShell>
  );
}
