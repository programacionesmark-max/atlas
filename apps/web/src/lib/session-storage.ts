const SESSION_KEY = 'ce:session:v1';

interface StoredSession {
  reconnectToken: string;
  nickname: string;
}

export function loadStoredSession(): StoredSession | null {
  const value = localStorage.getItem(SESSION_KEY);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StoredSession>;
    if (typeof parsed.reconnectToken !== 'string' || typeof parsed.nickname !== 'string')
      return null;
    return { reconnectToken: parsed.reconnectToken, nickname: parsed.nickname };
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
