import { describe, expect, it } from 'vitest';

import { stateChecksum } from '../src/persistence.js';

describe('stateChecksum', () => {
  it('is stable when JSON object keys arrive in a different order', () => {
    const first = { revision: 4, players: { a: { cash: 100 }, b: { cash: 200 } } };
    const second = { players: { b: { cash: 200 }, a: { cash: 100 } }, revision: 4 };

    expect(stateChecksum(first)).toBe(stateChecksum(second));
  });

  it('changes when authoritative state changes', () => {
    expect(stateChecksum({ revision: 4 })).not.toBe(stateChecksum({ revision: 5 }));
  });
});
