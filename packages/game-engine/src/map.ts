import { invariant } from './errors.js';
import type { MapConfig, PropertyConfig, TileConfig } from './types.js';

export function validateMapConfig(map: MapConfig): void {
  invariant(map.tiles.length >= 2, 'VALIDATION_FAILED', 'A map requires at least two tiles');
  const tiles = new Map(map.tiles.map((tile) => [tile.id, tile]));
  const properties = new Set(map.properties.map((property) => property.id));
  invariant(tiles.size === map.tiles.length, 'VALIDATION_FAILED', 'Tile ids must be unique');
  invariant(
    properties.size === map.properties.length,
    'VALIDATION_FAILED',
    'Property ids must be unique'
  );
  invariant(tiles.has(map.startTileId), 'VALIDATION_FAILED', 'Start tile does not exist');
  invariant(tiles.has(map.jailTileId), 'VALIDATION_FAILED', 'Jail tile does not exist');
  for (const tile of map.tiles) {
    invariant(tile.next.length > 0, 'VALIDATION_FAILED', `Tile ${tile.id} has no outgoing path`);
    for (const next of tile.next)
      invariant(
        tiles.has(next),
        'VALIDATION_FAILED',
        `Tile ${tile.id} points to missing tile ${next}`
      );
    if (tile.propertyId)
      invariant(
        properties.has(tile.propertyId),
        'VALIDATION_FAILED',
        `Tile ${tile.id} uses an unknown property`
      );
    if (tile.destinationTileId)
      invariant(
        tiles.has(tile.destinationTileId),
        'VALIDATION_FAILED',
        `Tile ${tile.id} has an unknown destination`
      );
  }
}

export function getTile(map: MapConfig, tileId: string): TileConfig {
  const tile = map.tiles.find((candidate) => candidate.id === tileId);
  invariant(tile, 'NOT_FOUND', `Unknown tile: ${tileId}`);
  return tile;
}

export function getPropertyConfig(map: MapConfig, propertyId: string): PropertyConfig {
  const property = map.properties.find((candidate) => candidate.id === propertyId);
  invariant(property, 'NOT_FOUND', `Unknown property: ${propertyId}`);
  return property;
}
