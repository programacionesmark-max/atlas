import type { MapConfig, PropertyConfig, TileConfig } from '../types.js';

const properties: readonly PropertyConfig[] = [
  {
    id: 'pulse-alley',
    name: 'London',
    category: 'PROPERTY',
    group: 'magenta',
    purchasePrice: 300,
    baseRent: 35,
    rentLevels: [35, 90, 230, 420, 650],
    mortgageValue: 150,
    upgradeCost: 150
  },
  {
    id: 'synth-court',
    name: 'Paris',
    category: 'PROPERTY',
    group: 'magenta',
    purchasePrice: 360,
    baseRent: 45,
    rentLevels: [45, 110, 270, 480, 720],
    mortgageValue: 180,
    upgradeCost: 150
  },
  {
    id: 'ion-terminal',
    name: 'New York',
    category: 'TRANSIT',
    group: 'transit',
    purchasePrice: 500,
    baseRent: 80,
    rentLevels: [80, 160, 320, 640],
    mortgageValue: 250,
    upgradeCost: 0
  },
  {
    id: 'holo-heights',
    name: 'Madrid',
    category: 'PROPERTY',
    group: 'cyan',
    purchasePrice: 520,
    baseRent: 65,
    rentLevels: [65, 170, 430, 740, 1050],
    mortgageValue: 260,
    upgradeCost: 220
  },
  {
    id: 'lumen-row',
    name: 'Rome',
    category: 'PROPERTY',
    group: 'cyan',
    purchasePrice: 580,
    baseRent: 75,
    rentLevels: [75, 190, 470, 800, 1150],
    mortgageValue: 290,
    upgradeCost: 220
  },
  {
    id: 'arcade-reactor',
    name: 'Dubai',
    category: 'BUSINESS',
    group: 'entertainment',
    purchasePrice: 650,
    baseRent: 95,
    rentLevels: [95, 230, 550, 900, 1300],
    mortgageValue: 325,
    upgradeCost: 260
  },
  {
    id: 'vector-vista',
    name: 'Cape Town',
    category: 'PROPERTY',
    group: 'amber',
    purchasePrice: 700,
    baseRent: 100,
    rentLevels: [100, 260, 610, 980, 1420],
    mortgageValue: 350,
    upgradeCost: 280
  },
  {
    id: 'photon-pier',
    name: 'Cairo',
    category: 'PROPERTY',
    group: 'amber',
    purchasePrice: 760,
    baseRent: 115,
    rentLevels: [115, 290, 670, 1060, 1510],
    mortgageValue: 380,
    upgradeCost: 280
  },
  {
    id: 'flux-exchange',
    name: 'Singapore',
    category: 'BUSINESS',
    group: 'finance',
    purchasePrice: 840,
    baseRent: 135,
    rentLevels: [135, 340, 760, 1180, 1680],
    mortgageValue: 420,
    upgradeCost: 320
  },
  {
    id: 'quantum-quay',
    name: 'Tokyo',
    category: 'PROPERTY',
    group: 'violet',
    purchasePrice: 900,
    baseRent: 150,
    rentLevels: [150, 380, 850, 1320, 1880],
    mortgageValue: 450,
    upgradeCost: 350
  },
  {
    id: 'nova-spire',
    name: 'Sydney',
    category: 'PROPERTY',
    group: 'violet',
    purchasePrice: 980,
    baseRent: 175,
    rentLevels: [175, 430, 940, 1450, 2050],
    mortgageValue: 490,
    upgradeCost: 350
  },
  {
    id: 'circuit-crown',
    name: 'Buenos Aires',
    category: 'PROPERTY',
    group: 'violet',
    purchasePrice: 1100,
    baseRent: 210,
    rentLevels: [210, 520, 1100, 1700, 2400],
    mortgageValue: 550,
    upgradeCost: 400
  },
  {
    id: 'maple-square',
    name: 'Toronto',
    region: 'Canadá',
    category: 'PROPERTY',
    group: 'north',
    purchasePrice: 620,
    baseRent: 82,
    rentLevels: [82, 210, 500, 830, 1200],
    mortgageValue: 310,
    upgradeCost: 240
  },
  {
    id: 'zocalo-center',
    name: 'Ciudad de México',
    region: 'México',
    category: 'PROPERTY',
    group: 'north',
    purchasePrice: 690,
    baseRent: 96,
    rentLevels: [96, 245, 570, 920, 1340],
    mortgageValue: 345,
    upgradeCost: 260
  },
  {
    id: 'savanna-gate',
    name: 'Nairobi',
    region: 'Kenia',
    category: 'PROPERTY',
    group: 'south',
    purchasePrice: 780,
    baseRent: 118,
    rentLevels: [118, 300, 690, 1090, 1560],
    mortgageValue: 390,
    upgradeCost: 290
  },
  {
    id: 'harbor-bazaar',
    name: 'Mumbai',
    region: 'India',
    category: 'BUSINESS',
    group: 'south',
    purchasePrice: 880,
    baseRent: 142,
    rentLevels: [142, 355, 800, 1240, 1760],
    mortgageValue: 440,
    upgradeCost: 330
  }
] as const;

const tile = (
  id: string,
  name: string,
  type: TileConfig['type'],
  next: string,
  extra: Omit<TileConfig, 'id' | 'name' | 'type' | 'next'> = {}
): TileConfig => ({ id, name, type, next: [next], ...extra });

const tiles: readonly TileConfig[] = [
  tile('neon-start', 'World Tour', 'START', 'pulse-alley'),
  tile('pulse-alley', 'London', 'PROPERTY', 'signal-event', { propertyId: 'pulse-alley' }),
  tile('signal-event', 'Travel Card', 'EVENT', 'synth-court', { eventDeck: 'neon-events' }),
  tile('synth-court', 'Paris', 'PROPERTY', 'ion-terminal', { propertyId: 'synth-court' }),
  tile('ion-terminal', 'New York', 'PROPERTY', 'data-tax', { propertyId: 'ion-terminal' }),
  tile('data-tax', 'Import Tax', 'TAX', 'neon-jail', { amount: 220 }),
  tile('neon-jail', 'Customs Hold', 'JAIL', 'holo-heights'),
  tile('holo-heights', 'Madrid', 'PROPERTY', 'prism-park', { propertyId: 'holo-heights' }),
  tile('prism-park', 'Travel Grant', 'BONUS', 'lumen-row', { amount: 180 }),
  tile('lumen-row', 'Rome', 'PROPERTY', 'arcade-reactor', { propertyId: 'lumen-row' }),
  tile('arcade-reactor', 'Dubai', 'PROPERTY', 'crosslink-event', {
    propertyId: 'arcade-reactor'
  }),
  tile('crosslink-event', 'Global News', 'EVENT', 'vector-vista', { eventDeck: 'neon-events' }),
  tile('vector-vista', 'Cape Town', 'PROPERTY', 'photon-pier', { propertyId: 'vector-vista' }),
  tile('photon-pier', 'Cairo', 'PROPERTY', 'go-to-hold', { propertyId: 'photon-pier' }),
  tile('go-to-hold', 'Passport Control', 'GO_TO_JAIL', 'flux-exchange', {
    destinationTileId: 'neon-jail'
  }),
  tile('flux-exchange', 'Singapore', 'PROPERTY', 'skybridge', { propertyId: 'flux-exchange' }),
  tile('skybridge', 'International Flight', 'TELEPORT', 'quantum-quay', {
    destinationTileId: 'signal-event'
  }),
  tile('quantum-quay', 'Tokyo', 'PROPERTY', 'luxury-tax', { propertyId: 'quantum-quay' }),
  tile('luxury-tax', 'Property Duty', 'TAX', 'nova-spire', { amount: 360 }),
  tile('nova-spire', 'Sydney', 'PROPERTY', 'late-event', { propertyId: 'nova-spire' }),
  tile('late-event', 'Market Bulletin', 'EVENT', 'circuit-crown', { eventDeck: 'neon-events' }),
  tile('circuit-crown', 'Buenos Aires', 'PROPERTY', 'cashback', { propertyId: 'circuit-crown' }),
  tile('cashback', 'Tourism Grant', 'BONUS', 'night-market-tile', { amount: 260 }),
  tile('night-market-tile', 'Global Exchange', 'MARKET', 'maple-square'),
  tile('maple-square', 'Toronto', 'PROPERTY', 'route-bonus', { propertyId: 'maple-square' }),
  tile('route-bonus', 'Travel Fund', 'BONUS', 'zocalo-center', { amount: 210 }),
  tile('zocalo-center', 'Mexico City', 'PROPERTY', 'world-fair', { propertyId: 'zocalo-center' }),
  tile('world-fair', 'World Fair', 'EVENT', 'savanna-gate', { eventDeck: 'neon-events' }),
  tile('savanna-gate', 'Nairobi', 'PROPERTY', 'departure-tax', { propertyId: 'savanna-gate' }),
  tile('departure-tax', 'Departure Tax', 'TAX', 'harbor-bazaar', { amount: 240 }),
  tile('harbor-bazaar', 'Mumbai', 'PROPERTY', 'world-flight', { propertyId: 'harbor-bazaar' }),
  tile('world-flight', 'Long-haul Flight', 'TELEPORT', 'neon-start', {
    destinationTileId: 'signal-event'
  })
] as const;

export const neonCityMap: MapConfig = {
  id: 'neon-city',
  name: 'World Capitals',
  theme: 'A global investment route through real cities, landmarks and international markets.',
  layout: 'CIRCUIT',
  startTileId: 'neon-start',
  jailTileId: 'neon-jail',
  tiles,
  properties,
  economy: {
    startingCash: 3200,
    passStartAward: 300,
    unmortgageInterestRate: 0.1,
    completeGroupRentMultiplier: 2
  },
  specialRules: ['32-space-route', 'global-exchange', 'travel-events']
};
