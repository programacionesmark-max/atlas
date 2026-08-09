import type { MapConfig, PropertyConfig, TileConfig } from '../types.js';

interface CitySeed {
  readonly name: string;
  readonly region: string;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function createRouteMap(
  id: string,
  name: string,
  theme: string,
  cities: readonly CitySeed[],
  passStartAward: number
): MapConfig {
  if (cities.length !== 20) throw new Error(`${name} requires exactly 20 destinations`);
  const properties: readonly PropertyConfig[] = cities.map((city, index) => {
    const purchasePrice = 220 + index * 45;
    const baseRent = 24 + index * 9;
    return {
      id: `${id}-${slug(city.name)}`,
      name: city.name,
      region: city.region,
      category: index === 4 || index === 14 ? 'TRANSIT' : index === 9 ? 'BUSINESS' : 'PROPERTY',
      group: `route-${Math.floor(index / 2)}`,
      purchasePrice,
      baseRent,
      rentLevels: [baseRent, baseRent * 3, baseRent * 7, baseRent * 12, baseRent * 18],
      mortgageValue: Math.floor(purchasePrice / 2),
      upgradeCost: 100 + Math.floor(index / 4) * 50
    };
  });

  const propertyTile = (index: number): Omit<TileConfig, 'next'> => ({
    id: properties[index]!.id,
    name: properties[index]!.name,
    type: 'PROPERTY',
    propertyId: properties[index]!.id
  });
  const raw: readonly Omit<TileConfig, 'next'>[] = [
    { id: `${id}-start`, name: 'Salida', type: 'START' },
    propertyTile(0),
    { id: `${id}-event-1`, name: 'Carta de viaje', type: 'EVENT', eventDeck: 'neon-events' },
    propertyTile(1),
    propertyTile(2),
    { id: `${id}-tax-1`, name: 'Tasa local', type: 'TAX', amount: 180 },
    propertyTile(3),
    propertyTile(4),
    { id: `${id}-jail`, name: 'Aduanas', type: 'JAIL' },
    propertyTile(5),
    { id: `${id}-bonus-1`, name: 'Beca de viaje', type: 'BONUS', amount: 170 },
    propertyTile(6),
    propertyTile(7),
    { id: `${id}-event-2`, name: 'Noticias', type: 'EVENT', eventDeck: 'neon-events' },
    propertyTile(8),
    propertyTile(9),
    {
      id: `${id}-go-jail`,
      name: 'Control fronterizo',
      type: 'GO_TO_JAIL',
      destinationTileId: `${id}-jail`
    },
    propertyTile(10),
    {
      id: `${id}-flight`,
      name: 'Vuelo directo',
      type: 'TELEPORT',
      destinationTileId: `${id}-event-1`
    },
    propertyTile(11),
    propertyTile(12),
    { id: `${id}-tax-2`, name: 'Impuesto turístico', type: 'TAX', amount: 320 },
    propertyTile(13),
    propertyTile(14),
    { id: `${id}-market`, name: 'Bolsa regional', type: 'MARKET' },
    propertyTile(15),
    { id: `${id}-event-3`, name: 'Mercado mundial', type: 'EVENT', eventDeck: 'neon-events' },
    propertyTile(16),
    propertyTile(17),
    { id: `${id}-bonus-2`, name: 'Fondo de inversión', type: 'BONUS', amount: 260 },
    propertyTile(18),
    propertyTile(19)
  ];
  const tiles = raw.map((tile, index) => ({
    ...tile,
    next: [raw[(index + 1) % raw.length]!.id]
  })) satisfies readonly TileConfig[];

  return {
    id,
    name,
    theme,
    layout: 'CIRCUIT',
    startTileId: `${id}-start`,
    jailTileId: `${id}-jail`,
    tiles,
    properties,
    economy: {
      startingCash: 3200,
      passStartAward,
      unmortgageInterestRate: 0.1,
      completeGroupRentMultiplier: 2
    },
    specialRules: ['32-space-route', 'regional-markets', 'travel-events']
  };
}

export const grandEuropeMap = createRouteMap(
  'grand-europe',
  'Gran Europa',
  'Una ruta extensa desde el Atlántico hasta el Bósforo.',
  [
    ['Lisboa', 'Portugal'],
    ['Madrid', 'España'],
    ['Barcelona', 'España'],
    ['París', 'Francia'],
    ['Londres', 'Reino Unido'],
    ['Ámsterdam', 'Países Bajos'],
    ['Bruselas', 'Bélgica'],
    ['Berlín', 'Alemania'],
    ['Copenhague', 'Dinamarca'],
    ['Estocolmo', 'Suecia'],
    ['Varsovia', 'Polonia'],
    ['Praga', 'Chequia'],
    ['Viena', 'Austria'],
    ['Budapest', 'Hungría'],
    ['Zúrich', 'Suiza'],
    ['Milán', 'Italia'],
    ['Roma', 'Italia'],
    ['Atenas', 'Grecia'],
    ['Dubrovnik', 'Croacia'],
    ['Estambul', 'Turquía']
  ].map(([name, region]) => ({ name: name!, region: region! })),
  280
);

export const americasMap = createRouteMap(
  'americas',
  'Américas',
  'De Canadá a la Patagonia por las grandes capitales del continente.',
  [
    ['Vancouver', 'Canadá'],
    ['Toronto', 'Canadá'],
    ['Nueva York', 'Estados Unidos'],
    ['Boston', 'Estados Unidos'],
    ['Chicago', 'Estados Unidos'],
    ['San Francisco', 'Estados Unidos'],
    ['Los Ángeles', 'Estados Unidos'],
    ['Ciudad de México', 'México'],
    ['La Habana', 'Cuba'],
    ['San José', 'Costa Rica'],
    ['Panamá', 'Panamá'],
    ['Cartagena', 'Colombia'],
    ['Bogotá', 'Colombia'],
    ['Quito', 'Ecuador'],
    ['Lima', 'Perú'],
    ['La Paz', 'Bolivia'],
    ['Río de Janeiro', 'Brasil'],
    ['São Paulo', 'Brasil'],
    ['Buenos Aires', 'Argentina'],
    ['Santiago', 'Chile']
  ].map(([name, region]) => ({ name: name!, region: region! })),
  300
);

export const asiaPacificMap = createRouteMap(
  'asia-pacific',
  'Asia-Pacífico',
  'Mercados costeros, megaciudades y rutas insulares del Pacífico.',
  [
    ['Tokio', 'Japón'],
    ['Osaka', 'Japón'],
    ['Seúl', 'Corea del Sur'],
    ['Pekín', 'China'],
    ['Shanghái', 'China'],
    ['Hong Kong', 'China'],
    ['Taipéi', 'Taiwán'],
    ['Hanói', 'Vietnam'],
    ['Bangkok', 'Tailandia'],
    ['Singapur', 'Singapur'],
    ['Kuala Lumpur', 'Malasia'],
    ['Yakarta', 'Indonesia'],
    ['Manila', 'Filipinas'],
    ['Mumbai', 'India'],
    ['Delhi', 'India'],
    ['Katmandú', 'Nepal'],
    ['Perth', 'Australia'],
    ['Melbourne', 'Australia'],
    ['Sídney', 'Australia'],
    ['Auckland', 'Nueva Zelanda']
  ].map(([name, region]) => ({ name: name!, region: region! })),
  320
);

export const extendedAtlasMaps = [grandEuropeMap, americasMap, asiaPacificMap] as const;
