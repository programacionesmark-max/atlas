import type { MatchRecap } from '@circuit/shared';

import { loadStoredSession } from './session-storage';
import { serverUrl } from './socket';

export async function fetchMatchRecap(gameId: string): Promise<MatchRecap> {
  const stored = loadStoredSession();
  const response = await fetch(`${serverUrl}/matches/${encodeURIComponent(gameId)}`, {
    ...(stored ? { headers: { Authorization: `Bearer ${stored.reconnectToken}` } } : {})
  });
  if (!response.ok) throw new Error('This match recap is not available.');
  return (await response.json()) as MatchRecap;
}
