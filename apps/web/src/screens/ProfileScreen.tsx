import { ArrowLeft, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageShell } from '../components/PageShell';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { ScreenTransition } from '../components/ScreenTransition';
import { useRealtimeStore } from '../store/realtime';

export function ProfileScreen() {
  const identity = useRealtimeStore((state) => state.identity);

  return (
    <PageShell>
      <ScreenTransition className="profile-screen page-container">
        <Link to="/" className="back-link">
          <ArrowLeft aria-hidden="true" /> Back to home
        </Link>
        <section className="profile-identity">
          {identity ? (
            <PlayerAvatar name={identity.nickname} color="#33b8ff" size={92} />
          ) : (
            <UserRound size={72} />
          )}
          <div>
            <span className="section-label">Current identity</span>
            <h1>{identity?.nickname ?? 'No active session'}</h1>
            <p>{identity ? 'Guest account' : 'Choose a nickname on Home to begin.'}</p>
          </div>
          {identity ? (
            <span className="status-badge">
              <ShieldCheck /> Server-issued session
            </span>
          ) : null}
        </section>
        <div className="profile-empty">
          <h2>Registered progression is the next release track</h2>
          <p>
            Your live game identity is real and reconnectable. Persistent profile statistics
            activate after account registration is enabled.
          </p>
          <Link className="button button--secondary" to="/">
            Play as guest
          </Link>
        </div>
      </ScreenTransition>
    </PageShell>
  );
}
