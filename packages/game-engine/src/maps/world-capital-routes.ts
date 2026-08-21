import type { FlightOption, MapConfig, PropertyConfig, TileConfig } from '../types.js';

interface CitySeed {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly x: number;
  readonly y: number;
}

const cities = [
  { id: 'london', name: 'Londres', country: 'Reino Unido', x: 47, y: 25 },
  { id: 'manchester', name: 'Manchester', country: 'Reino Unido', x: 45.5, y: 22.5 },
  { id: 'birmingham', name: 'Birmingham', country: 'Reino Unido', x: 46.2, y: 24 },
  { id: 'paris', name: 'París', country: 'Francia', x: 48.5, y: 29 },
  { id: 'lyon', name: 'Lyon', country: 'Francia', x: 49.5, y: 33 },
  { id: 'marseille', name: 'Marsella', country: 'Francia', x: 49.2, y: 35.2 },
  { id: 'madrid', name: 'Madrid', country: 'España', x: 44, y: 36 },
  { id: 'barcelona', name: 'Barcelona', country: 'España', x: 48, y: 35.5 },
  { id: 'valencia', name: 'Valencia', country: 'España', x: 46.2, y: 37.2 },
  { id: 'rome', name: 'Roma', country: 'Italia', x: 53, y: 37 },
  { id: 'milan', name: 'Milán', country: 'Italia', x: 51.5, y: 33.5 },
  { id: 'naples', name: 'Nápoles', country: 'Italia', x: 53.7, y: 39 },
  { id: 'cairo', name: 'El Cairo', country: 'Egipto', x: 59.5, y: 44 },
  { id: 'alexandria', name: 'Alejandría', country: 'Egipto', x: 58, y: 41 },
  { id: 'giza', name: 'Guiza', country: 'Egipto', x: 58.8, y: 45.2 },
  { id: 'nairobi', name: 'Nairobi', country: 'Kenia', x: 64, y: 58 },
  { id: 'mombasa', name: 'Mombasa', country: 'Kenia', x: 66, y: 61 },
  { id: 'cape-town', name: 'Ciudad del Cabo', country: 'Sudáfrica', x: 57, y: 78 },
  { id: 'johannesburg', name: 'Johannesburgo', country: 'Sudáfrica', x: 60.5, y: 71 },
  { id: 'dubai', name: 'Dubái', country: 'Emiratos Árabes Unidos', x: 66.5, y: 44 },
  { id: 'abu-dhabi', name: 'Abu Dabi', country: 'Emiratos Árabes Unidos', x: 65, y: 46 },
  { id: 'mumbai', name: 'Bombay', country: 'India', x: 70.5, y: 51 },
  { id: 'delhi', name: 'Delhi', country: 'India', x: 71.5, y: 45 },
  { id: 'kolkata', name: 'Calcuta', country: 'India', x: 75, y: 49 },
  { id: 'bangkok', name: 'Bangkok', country: 'Tailandia', x: 78, y: 55 },
  { id: 'chiang-mai', name: 'Chiang Mai', country: 'Tailandia', x: 77, y: 50.5 },
  { id: 'tokyo', name: 'Tokio', country: 'Japón', x: 89, y: 36 },
  { id: 'osaka', name: 'Osaka', country: 'Japón', x: 86.5, y: 39.5 },
  { id: 'kyoto', name: 'Kioto', country: 'Japón', x: 87.2, y: 38 },
  { id: 'sydney', name: 'Sídney', country: 'Australia', x: 88, y: 79 },
  { id: 'melbourne', name: 'Melbourne', country: 'Australia', x: 84.5, y: 77 },
  { id: 'buenos-aires', name: 'Buenos Aires', country: 'Argentina', x: 35, y: 80 },
  { id: 'cordoba', name: 'Córdoba', country: 'Argentina', x: 32.5, y: 74 },
  { id: 'mexico-city', name: 'Ciudad de México', country: 'México', x: 22, y: 49 },
  { id: 'guadalajara', name: 'Guadalajara', country: 'México', x: 19.5, y: 45 },
  { id: 'los-angeles', name: 'Los Ángeles', country: 'Estados Unidos', x: 14, y: 38 },
  { id: 'chicago', name: 'Chicago', country: 'Estados Unidos', x: 23, y: 31 },
  { id: 'new-york', name: 'Nueva York', country: 'Estados Unidos', x: 29, y: 32.5 },
  { id: 'toronto', name: 'Toronto', country: 'Canadá', x: 28.5, y: 27 },
  { id: 'vancouver', name: 'Vancouver', country: 'Canadá', x: 14.5, y: 28 }
] as const satisfies readonly CitySeed[];

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const properties = cities.map((city, index) => {
  const purchasePrice = 260 + Math.floor(index / 2) * 55;
  const baseRent = 28 + Math.floor(index / 2) * 8;
  return {
    id: city.id,
    name: city.name,
    region: city.country,
    category: 'PROPERTY',
    group: `country-${slug(city.country)}`,
    purchasePrice,
    baseRent,
    rentLevels: [baseRent, baseRent * 3, baseRent * 7, baseRent * 13, baseRent * 21],
    mortgageValue: Math.floor(purchasePrice / 2),
    upgradeCost: 140 + Math.floor(index / 8) * 60
  } satisfies PropertyConfig;
});

const cityById = new Map<string, CitySeed>(cities.map((city) => [city.id, city]));

function cityTile(id: string): Omit<TileConfig, 'next'> {
  const city = cityById.get(id);
  if (!city) throw new Error(`Unknown city seed: ${id}`);
  return {
    id,
    name: city.name,
    type: 'PROPERTY',
    propertyId: id,
    mapPosition: { x: city.x, y: city.y }
  };
}

function flight(
  id: string,
  name: string,
  x: number,
  y: number,
  options: readonly FlightOption[]
): Omit<TileConfig, 'next'> {
  return { id, name, type: 'TELEPORT', mapPosition: { x, y }, flightOptions: options };
}

const route: readonly Omit<TileConfig, 'next'>[] = [
  { id: 'world-start', name: 'Vuelta al mundo', type: 'START', mapPosition: { x: 43, y: 19 } },
  cityTile('london'),
  cityTile('manchester'),
  cityTile('birmingham'),
  {
    id: 'europe-news',
    name: 'Noticias europeas',
    type: 'EVENT',
    eventDeck: 'neon-events',
    mapPosition: { x: 46, y: 27.5 }
  },
  cityTile('paris'),
  cityTile('lyon'),
  cityTile('marseille'),
  flight('europe-airport', 'Aeropuerto europeo', 51, 30, [
    { destinationTileId: 'new-york', fee: 240, label: 'Vuelo transatlántico' },
    { destinationTileId: 'dubai', fee: 300, label: 'Ruta del Golfo' },
    { destinationTileId: 'tokyo', fee: 420, label: 'Expreso a Japón' }
  ]),
  cityTile('madrid'),
  cityTile('barcelona'),
  cityTile('valencia'),
  {
    id: 'europe-tax',
    name: 'Tasa continental',
    type: 'TAX',
    amount: 180,
    mapPosition: { x: 50, y: 38 }
  },
  cityTile('rome'),
  cityTile('milan'),
  cityTile('naples'),
  cityTile('cairo'),
  cityTile('alexandria'),
  cityTile('giza'),
  flight('africa-airport', 'Conexión africana', 60.5, 48, [
    { destinationTileId: 'cape-town', fee: 230, label: 'Ruta austral' },
    { destinationTileId: 'buenos-aires', fee: 410, label: 'Salto del Atlántico Sur' },
    { destinationTileId: 'dubai', fee: 190, label: 'Conexión del Golfo' }
  ]),
  cityTile('nairobi'),
  cityTile('mombasa'),
  cityTile('cape-town'),
  cityTile('johannesburg'),
  {
    id: 'africa-fund',
    name: 'Fondo de expansión',
    type: 'BONUS',
    amount: 260,
    mapPosition: { x: 63, y: 67 }
  },
  cityTile('dubai'),
  cityTile('abu-dhabi'),
  flight('gulf-airport', 'Hub del Golfo', 68, 47, [
    { destinationTileId: 'mumbai', fee: 170, label: 'Puente a India' },
    { destinationTileId: 'bangkok', fee: 240, label: 'Ruta del Sudeste Asiático' },
    { destinationTileId: 'london', fee: 360, label: 'Regreso a Londres' }
  ]),
  cityTile('mumbai'),
  cityTile('delhi'),
  cityTile('kolkata'),
  {
    id: 'asia-news',
    name: 'Mercados asiáticos',
    type: 'EVENT',
    eventDeck: 'neon-events',
    mapPosition: { x: 75, y: 47 }
  },
  cityTile('bangkok'),
  cityTile('chiang-mai'),
  cityTile('tokyo'),
  cityTile('osaka'),
  cityTile('kyoto'),
  flight('pacific-airport', 'Puerta del Pacífico', 84, 45, [
    { destinationTileId: 'sydney', fee: 250, label: 'Corredor de Oceanía' },
    { destinationTileId: 'los-angeles', fee: 440, label: 'Vuelo transpacífico' },
    { destinationTileId: 'london', fee: 480, label: 'Vuelta larga a Europa' }
  ]),
  cityTile('sydney'),
  cityTile('melbourne'),
  { id: 'global-market', name: 'Bolsa mundial', type: 'MARKET', mapPosition: { x: 72, y: 81 } },
  cityTile('buenos-aires'),
  cityTile('cordoba'),
  flight('south-america-airport', 'Hub sudamericano', 38, 69, [
    { destinationTileId: 'mexico-city', fee: 220, label: 'Corredor latino' },
    { destinationTileId: 'madrid', fee: 390, label: 'Ruta iberoamericana' },
    { destinationTileId: 'cape-town', fee: 360, label: 'Puente del Atlántico Sur' }
  ]),
  cityTile('mexico-city'),
  cityTile('guadalajara'),
  cityTile('los-angeles'),
  cityTile('chicago'),
  cityTile('new-york'),
  {
    id: 'passport-control',
    name: 'Control de pasaportes',
    type: 'GO_TO_JAIL',
    destinationTileId: 'world-customs',
    mapPosition: { x: 24, y: 35 }
  },
  cityTile('toronto'),
  cityTile('vancouver'),
  flight('north-america-airport', 'Terminal norteamericana', 23, 24, [
    { destinationTileId: 'london', fee: 260, label: 'Atlántico Norte' },
    { destinationTileId: 'tokyo', fee: 430, label: 'Ruta polar a Tokio' },
    { destinationTileId: 'buenos-aires', fee: 370, label: 'Expreso continental' }
  ]),
  {
    id: 'world-customs',
    name: 'Aduanas internacionales',
    type: 'JAIL',
    mapPosition: { x: 35, y: 22 }
  }
];

const tiles = route.map((tile, index) => ({
  ...tile,
  next: [route[(index + 1) % route.length]!.id]
})) satisfies readonly TileConfig[];

export const worldCapitalRoutesMap: MapConfig = {
  id: 'world-capital-routes',
  name: 'Rutas del Mundo',
  theme: 'Compra ciudades, completa países y construye casas y hoteles.',
  layout: 'BRANCHING',
  startTileId: 'world-start',
  jailTileId: 'world-customs',
  tiles,
  properties,
  economy: {
    startingCash: 4200,
    passStartAward: 400,
    unmortgageInterestRate: 0.1,
    completeGroupRentMultiplier: 2
  },
  specialRules: [
    'country-portfolios',
    'paid-flight-branches',
    'step-by-step-movement',
    'four-development-levels'
  ]
};
