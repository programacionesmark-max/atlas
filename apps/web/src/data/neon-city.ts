import { getAtlasMap, type VisualTile } from './atlas';

const worldMap = getAtlasMap('neon-city');
export type { VisualTile };
export const neonCityTiles: readonly VisualTile[] = worldMap.tiles;
export const neonCityProperties = worldMap.properties;
