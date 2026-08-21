import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadServerConfig } from '../src/config.js';

describe('production CORS configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('always permits the official Vercel client alongside configured origins', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'a-production-secret-that-is-long-enough');
    vi.stubEnv('DATABASE_DISABLED', 'true');
    vi.stubEnv('CORS_ORIGINS', 'https://atlas-estates-game.vercel.app');

    expect(loadServerConfig().corsOrigins).toEqual([
      'https://atlas-estates-game.vercel.app',
      'https://atlas-estates-world.vercel.app'
    ]);
  });
});
