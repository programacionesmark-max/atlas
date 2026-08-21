interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: (bytes: Uint8Array) => Uint8Array;
}

let fallbackSequence = 0;

/**
 * Creates an RFC 4122 v4 identifier in secure and non-secure browser contexts.
 * `crypto.randomUUID()` is unavailable on LAN HTTP origins in several browsers.
 */
export function createClientId(cryptoApi: CryptoLike | undefined = globalThis.crypto): string {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    fallbackSequence += 1;
    let seed = Date.now() + fallbackSequence * 997;
    for (let index = 0; index < bytes.length; index += 1) {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      bytes[index] = seed & 0xff;
    }
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
