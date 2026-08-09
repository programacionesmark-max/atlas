import { beforeEach, describe, expect, it } from 'vitest';

import { clearStoredSession, loadStoredSession, saveStoredSession } from './session-storage';

describe('versioned session storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a reconnectable guest identity', () => {
    saveStoredSession({ reconnectToken: 'signed-token', nickname: 'Jamie' });
    expect(loadStoredSession()).toEqual({ reconnectToken: 'signed-token', nickname: 'Jamie' });
  });

  it('rejects malformed browser state instead of trusting it', () => {
    localStorage.setItem('ce:session:v1', '{"nickname":42}');
    expect(loadStoredSession()).toBeNull();
    clearStoredSession();
    expect(loadStoredSession()).toBeNull();
  });
});
