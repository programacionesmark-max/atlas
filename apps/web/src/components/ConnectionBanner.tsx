import { WifiOff, X } from 'lucide-react';

import { useRealtimeStore } from '../store/realtime';

export function ConnectionBanner() {
  const connected = useRealtimeStore((state) => state.connected);
  const error = useRealtimeStore((state) => state.error);
  const clearError = useRealtimeStore((state) => state.clearError);

  if (connected && !error) return null;

  return (
    <div
      className={error ? 'connection-banner connection-banner--error' : 'connection-banner'}
      role="status"
    >
      <WifiOff aria-hidden="true" />
      <span>{error ?? 'Reconnecting to the game server…'}</span>
      {error ? (
        <button type="button" onClick={clearError} aria-label="Dismiss error">
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
