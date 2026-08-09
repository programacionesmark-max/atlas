import {
  americasMap,
  asiaPacificMap,
  grandEuropeMap,
  neonCityMap,
  worldCapitalRoutesMap,
  type MapConfig,
  type PropertyConfig,
  type TileType
} from '@circuit/game-engine';
import type { GameMode, RoomRules } from '@circuit/shared';

export interface VisualTile {
  id: string;
  name: string;
  kind: TileType;
  region?: string;
  price?: number;
  group?: string;
}

export interface AtlasMapView {
  config: MapConfig;
  tiles: readonly VisualTile[];
  properties: ReadonlyMap<string, PropertyConfig>;
  image: string;
  eyebrow: string;
  accent: string;
}

const legacyRegions: Readonly<Record<string, string>> = {
  'pulse-alley': 'Reino Unido',
  'synth-court': 'Francia',
  'ion-terminal': 'Estados Unidos',
  'holo-heights': 'España',
  'lumen-row': 'Italia',
  'arcade-reactor': 'Emiratos Árabes Unidos',
  'vector-vista': 'Sudáfrica',
  'photon-pier': 'Egipto',
  'flux-exchange': 'Singapur',
  'quantum-quay': 'Japón',
  'nova-spire': 'Australia',
  'circuit-crown': 'Argentina'
};

const mapPresentation: Readonly<
  Record<string, Pick<AtlasMapView, 'image' | 'eyebrow' | 'accent'>>
> = {
  'world-capital-routes': {
    image: '/assets/world-diorama.webp',
    eyebrow: '32 ciudades · 16 países · 6 aeropuertos',
    accent: '#173d52'
  },
  'neon-city': {
    image: '/assets/world-diorama.webp',
    eyebrow: 'Ruta global · 16 ciudades',
    accent: '#173d52'
  },
  'grand-europe': {
    image: '/assets/europe-diorama.webp',
    eyebrow: '20 ciudades · 14 países',
    accent: '#6e5631'
  },
  americas: {
    image: '/assets/americas-diorama.webp',
    eyebrow: '20 ciudades · norte a sur',
    accent: '#365f45'
  },
  'asia-pacific': {
    image: '/assets/asia-pacific-diorama.webp',
    eyebrow: '20 ciudades · costa del Pacífico',
    accent: '#7c4a53'
  }
};

export const ATLAS_MAP_CONFIGS = [
  worldCapitalRoutesMap,
  neonCityMap,
  grandEuropeMap,
  americasMap,
  asiaPacificMap
] as const;

export const ATLAS_MAPS: readonly AtlasMapView[] = ATLAS_MAP_CONFIGS.map((config) => {
  const properties = new Map(config.properties.map((property) => [property.id, property]));
  const presentation = mapPresentation[config.id]!;
  return {
    config,
    properties,
    ...presentation,
    tiles: config.tiles.map((tile) => {
      const property = tile.propertyId ? properties.get(tile.propertyId) : undefined;
      return {
        id: tile.id,
        name: tile.name,
        kind: tile.type,
        ...(property?.region || legacyRegions[tile.id]
          ? { region: property?.region ?? legacyRegions[tile.id] }
          : {}),
        ...(property ? { price: property.purchasePrice, group: property.group } : {})
      };
    })
  };
});

export function getAtlasMap(mapId: string): AtlasMapView {
  return ATLAS_MAPS.find((map) => map.config.id === mapId) ?? ATLAS_MAPS[0]!;
}

export interface ModePresentation {
  id: GameMode;
  name: string;
  icon: string;
  description: string;
  rules: readonly string[];
  preset: Partial<RoomRules> & { maxPlayers?: number };
}

export const ATLAS_MODES: readonly ModePresentation[] = [
  {
    id: 'CLASSIC',
    name: 'Clásico',
    icon: '◆',
    description: 'Compra, negocia y construye hasta dominar el tablero.',
    rules: ['30 rondas', '$3.200 iniciales', 'Reglas equilibradas'],
    preset: {
      startingCash: 3200,
      turnTimerSeconds: 45,
      victoryMode: 'LAST_PLAYER_STANDING',
      maxRounds: 30,
      netWorthTarget: null
    }
  },
  {
    id: 'BLITZ',
    name: 'Blitz',
    icon: 'ϟ',
    description: 'Una partida rápida decidida por patrimonio.',
    rules: ['12 rondas', 'Turnos de 30 s', 'Subastas de 12 s'],
    preset: {
      startingCash: 2400,
      turnTimerSeconds: 30,
      victoryMode: 'MOST_NET_WORTH',
      maxRounds: 12,
      netWorthTarget: null
    }
  },
  {
    id: 'CHAOS',
    name: 'Caos',
    icon: '◎',
    description: 'El mercado cambia cada vuelta y las rentas golpean más.',
    rules: ['Mercado ±$350', 'Rentas +25%', '18 rondas'],
    preset: {
      startingCash: 3000,
      turnTimerSeconds: 30,
      victoryMode: 'MOST_NET_WORTH',
      maxRounds: 18,
      netWorthTarget: null,
      economicEventsEnabled: true
    }
  },
  {
    id: 'TYCOON',
    name: 'Magnate',
    icon: '♛',
    description: 'Construcción intensiva con una meta clara de patrimonio.',
    rules: ['$12.000 objetivo', '5 mejoras', 'Rentas +15%'],
    preset: {
      startingCash: 4500,
      turnTimerSeconds: 60,
      victoryMode: 'NET_WORTH_TARGET',
      maxRounds: null,
      netWorthTarget: 12000
    }
  },
  {
    id: 'TEAMS',
    name: 'Equipos',
    icon: '◉',
    description: 'Dos equipos alternos comparten el resultado final.',
    rules: ['2 equipos', 'Patrimonio conjunto', '24 rondas'],
    preset: {
      startingCash: 3200,
      turnTimerSeconds: 45,
      victoryMode: 'TEAM_NET_WORTH',
      maxRounds: 24,
      netWorthTarget: null,
      maxPlayers: 4
    }
  },
  {
    id: 'BATTLE_ROYALE',
    name: 'Supervivencia',
    icon: '⬟',
    description: 'El líder paga una tasa cada ronda: nadie puede relajarse.',
    rules: ['$250 al líder', 'Rentas +20%', '20 rondas'],
    preset: {
      startingCash: 2800,
      turnTimerSeconds: 30,
      victoryMode: 'MOST_NET_WORTH',
      maxRounds: 20,
      netWorthTarget: null
    }
  },
  {
    id: 'DUEL',
    name: 'Duelo',
    icon: '⚔',
    description: 'Cara a cara, ritmo alto y desenlace por patrimonio.',
    rules: ['Exactamente 2', '16 rondas', 'Rentas +15%'],
    preset: {
      startingCash: 3000,
      turnTimerSeconds: 30,
      victoryMode: 'MOST_NET_WORTH',
      maxRounds: 16,
      netWorthTarget: null,
      maxPlayers: 2
    }
  },
  {
    id: 'LAND_RUSH',
    name: 'Fiebre inmobiliaria',
    icon: '⌂',
    description: 'Propiedades un 30% más baratas para ocupar el mapa deprisa.',
    rules: ['Compras −30%', '$10.000 objetivo', '$5.000 iniciales'],
    preset: {
      startingCash: 5000,
      turnTimerSeconds: 45,
      victoryMode: 'NET_WORTH_TARGET',
      maxRounds: 16,
      netWorthTarget: 10000
    }
  },
  {
    id: 'CUSTOM',
    name: 'A medida',
    icon: '✦',
    description: 'Ajusta dinero, tiempo, eventos, subastas y victoria.',
    rules: ['Reglas editables', '2–8 jugadores', 'Tu propia ruta'],
    preset: {}
  }
];
