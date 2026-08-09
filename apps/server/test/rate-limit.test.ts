import { describe, expect, it } from 'vitest';

import { SlidingWindowRateLimiter } from '../src/rate-limit.js';

describe('SlidingWindowRateLimiter', () => {
  it('blocks requests over the limit and permits them after the window', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1_000);

    expect(limiter.consume('client', 1_000)).toBe(true);
    expect(limiter.consume('client', 1_500)).toBe(true);
    expect(limiter.consume('client', 1_999)).toBe(false);
    expect(limiter.consume('client', 2_001)).toBe(true);
  });

  it('keeps independent windows per client', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1_000);

    expect(limiter.consume('first', 1_000)).toBe(true);
    expect(limiter.consume('second', 1_000)).toBe(true);
    expect(limiter.consume('first', 1_001)).toBe(false);
  });
});
