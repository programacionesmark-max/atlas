import { ArrowRight, LockKeyhole, MapPinned, Search, Zap } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageShell } from '../components/PageShell';
import { ScreenTransition } from '../components/ScreenTransition';
import { loadStoredSession } from '../lib/session-storage';
import { useRealtimeStore } from '../store/realtime';

export function HomeScreen() {
  const navigate = useNavigate();
  const { code: invitationCode } = useParams();
  const createSession = useRealtimeStore((state) => state.createSession);
  const quickPlay = useRealtimeStore((state) => state.quickPlay);
  const joinRoom = useRealtimeStore((state) => state.joinRoom);
  const identity = useRealtimeStore((state) => state.identity);
  const connected = useRealtimeStore((state) => state.connected);
  const pending = useRealtimeStore((state) => state.sessionPending);
  const [nickname, setNickname] = useState(
    () => identity?.nickname ?? loadStoredSession()?.nickname ?? ''
  );
  const [submitting, setSubmitting] = useState(false);

  async function ensureIdentity(): Promise<void> {
    if (identity) return;
    await createSession(nickname.trim());
  }

  async function runQuickPlay(): Promise<void> {
    setSubmitting(true);
    try {
      await ensureIdentity();
      const room = invitationCode ? await joinRoom(invitationCode) : await quickPlay();
      void navigate(`/room/${room.code}`);
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuickPlay(event: FormEvent): void {
    event.preventDefault();
    void runQuickPlay();
  }

  async function openRooms(createPrivate = false): Promise<void> {
    setSubmitting(true);
    try {
      await ensureIdentity();
      void navigate(createPrivate ? '/rooms?create=private' : '/rooms');
    } finally {
      setSubmitting(false);
    }
  }

  async function openRoutes(): Promise<void> {
    setSubmitting(true);
    try {
      await ensureIdentity();
      void navigate('/rooms?create=public');
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = !connected || pending || submitting || nickname.trim().length < 2;

  return (
    <PageShell quiet>
      <ScreenTransition className="home-screen">
        <div className="home-screen__backdrop" aria-hidden="true" />
        <section className="home-hero" aria-labelledby="home-title">
          <h1 id="home-title" className="home-logo">
            <span>ATLAS</span>
            <span>ESTATES</span>
          </h1>
          <p>Own the world, one city at a time.</p>
          <form onSubmit={handleQuickPlay} className="home-form">
            <label htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              minLength={2}
              maxLength={24}
              autoComplete="nickname"
              placeholder="Enter a nickname"
              required
            />
            <button
              className="button button--primary button--hero"
              type="submit"
              disabled={disabled}
            >
              {submitting ? 'Connecting…' : invitationCode ? 'Join game' : 'Play'}{' '}
              <ArrowRight aria-hidden="true" />
            </button>
          </form>
          <div className="home-actions" aria-label="Play options">
            <button type="button" onClick={() => void runQuickPlay()} disabled={disabled}>
              <Zap aria-hidden="true" /> <span>Quick play</span>
            </button>
            <button type="button" onClick={() => void openRooms()} disabled={disabled}>
              <Search aria-hidden="true" /> <span>Browse rooms</span>
            </button>
            <button type="button" onClick={() => void openRoutes()} disabled={disabled}>
              <MapPinned aria-hidden="true" /> <span>Maps & modes</span>
            </button>
            <button type="button" onClick={() => void openRooms(true)} disabled={disabled}>
              <LockKeyhole aria-hidden="true" /> <span>Create private game</span>
            </button>
          </div>
        </section>
      </ScreenTransition>
    </PageShell>
  );
}
