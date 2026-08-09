import type { RandomSource } from './types.js';

export class SequenceRandomSource implements RandomSource {
  private index = 0;
  constructor(private readonly values: readonly number[]) {
    if (values.length === 0) throw new Error('SequenceRandomSource requires values');
  }
  nextInt(minInclusive: number, maxInclusive: number): number {
    const value = this.values[this.index++ % this.values.length];
    if (value === undefined || value < minInclusive || value > maxInclusive) {
      throw new RangeError(
        `Injected random value must be between ${minInclusive} and ${maxInclusive}`
      );
    }
    return value;
  }
}

export class CryptoRandomSource implements RandomSource {
  nextInt(minInclusive: number, maxInclusive: number): number {
    if (
      !Number.isSafeInteger(minInclusive) ||
      !Number.isSafeInteger(maxInclusive) ||
      maxInclusive < minInclusive
    ) {
      throw new RangeError('Invalid random range');
    }
    const range = maxInclusive - minInclusive + 1;
    const max = Math.floor(0x1_0000_0000 / range) * range;
    const buffer = new Uint32Array(1);
    let value: number;
    do {
      globalThis.crypto.getRandomValues(buffer);
      value = buffer[0] ?? 0;
    } while (value >= max);
    return minInclusive + (value % range);
  }
}

export function shuffle<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = random.nextInt(0, index);
    const value = result[index];
    result[index] = result[swapIndex] as T;
    result[swapIndex] = value as T;
  }
  return result;
}
