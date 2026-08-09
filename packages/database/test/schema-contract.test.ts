import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');

describe('production database schema', () => {
  it.each([
    'User',
    'UserSession',
    'Room',
    'RoomMember',
    'Game',
    'GamePlayer',
    'GameEvent',
    'GameSnapshot',
    'MatchResult',
    'UserStatistics'
  ])('contains the %s model', (model) => {
    expect(schema).toContain(`model ${model} {`);
  });

  it('enforces action idempotency and snapshot uniqueness', () => {
    expect(schema).toContain('@@unique([gameId, actionId])');
    expect(schema).toContain('@@unique([gameId, revision])');
  });
});
