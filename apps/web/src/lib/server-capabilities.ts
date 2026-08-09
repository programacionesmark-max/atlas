import { serverUrl } from './socket';

const LEGACY_MAP_IDS = ['neon-city', 'grand-europe', 'americas', 'asia-pacific'] as const;

let supportedMapIdsPromise: Promise<readonly string[]> | null = null;

export function getSupportedMapIds(): Promise<readonly string[]> {
  supportedMapIdsPromise ??= fetch(`${serverUrl}/ready`, {
    headers: { Accept: 'application/json' }
  })
    .then(async (response) => {
      if (!response.ok) return LEGACY_MAP_IDS;
      const payload = (await response.json()) as { supportedMaps?: unknown };
      return Array.isArray(payload.supportedMaps) &&
        payload.supportedMaps.every((mapId) => typeof mapId === 'string')
        ? payload.supportedMaps
        : LEGACY_MAP_IDS;
    })
    .catch(() => LEGACY_MAP_IDS);

  return supportedMapIdsPromise;
}
