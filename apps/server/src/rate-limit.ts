export class SlidingWindowRateLimiter {
  private readonly entries = new Map<string, number[]>();
  private operations = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  consume(key: string, now = Date.now()): boolean {
    this.operations += 1;
    if (this.operations % 256 === 0) this.prune(now);
    const cutoff = now - this.windowMs;
    const recent = (this.entries.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= this.limit) {
      this.entries.set(key, recent);
      return false;
    }
    recent.push(now);
    this.entries.set(key, recent);
    return true;
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  prune(now = Date.now()): void {
    const cutoff = now - this.windowMs;
    for (const [key, timestamps] of this.entries) {
      const recent = timestamps.filter((timestamp) => timestamp > cutoff);
      if (recent.length === 0) this.entries.delete(key);
      else this.entries.set(key, recent);
    }
  }
}
