import { describe, expect, it } from 'vitest';

import {
  createRoomSchema,
  gameActionSchema,
  nicknameSchema,
  roomCodeSchema
} from '../src/index.js';

describe('public protocol schemas', () => {
  it('normalizes valid lobby codes and rejects ambiguous characters', () => {
    expect(roomCodeSchema.parse('ab2cd3')).toBe('AB2CD3');
    expect(roomCodeSchema.safeParse('ABC1O0').success).toBe(false);
  });

  it('rejects markup in nicknames', () => {
    expect(nicknameSchema.safeParse('<script>').success).toBe(false);
    expect(nicknameSchema.parse('Jamie_2')).toBe('Jamie_2');
  });

  it('rejects unknown room fields and malformed action identifiers', () => {
    const room = createRoomSchema.safeParse({
      settings: {
        name: 'Weekend game',
        visibility: 'PUBLIC',
        maxPlayers: 4,
        mapId: 'neon-city',
        mode: 'CLASSIC',
        allowSpectators: false,
        rules: {},
        injected: true
      }
    });
    expect(room.success).toBe(false);
    expect(
      gameActionSchema.safeParse({
        roomId: 'e71be0f1-f743-4d71-8e6f-aa236668b875',
        action: { actionId: 'repeat-me', expectedVersion: 0, type: 'ROLL_DICE' }
      }).success
    ).toBe(false);
  });
});
