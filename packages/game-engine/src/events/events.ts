import type { ActiveEffect } from '../types.js';

export type EventEffect =
  | { readonly kind: 'CASH'; readonly amount: number }
  | { readonly kind: 'PERCENT_CASH'; readonly percent: number }
  | { readonly kind: 'MOVE'; readonly tileId: string; readonly collectSalary: boolean }
  | { readonly kind: 'ALL_PLAYERS_CASH'; readonly amount: number }
  | { readonly kind: 'ACTIVE_EFFECT'; readonly effect: ActiveEffect };

export interface EventDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly effect: EventEffect;
}

const cash = (id: string, name: string, description: string, amount: number): EventDefinition => ({
  id,
  name,
  description,
  effect: { kind: 'CASH', amount }
});

export const EVENT_DEFINITIONS: readonly EventDefinition[] = [
  {
    id: 'market-crash',
    name: 'Market Crash',
    description: 'Lose 15% of your cash.',
    effect: { kind: 'PERCENT_CASH', percent: -15 }
  },
  cash('crypto-boom', 'Property Boom', 'A well-timed sale pays off.', 550),
  cash('tax-refund', 'Tax Refund', 'The council corrects its books.', 300),
  {
    id: 'rent-boost',
    name: 'Peak Season',
    description: 'Tourist demand raises your rent for two turns.',
    effect: {
      kind: 'ACTIVE_EFFECT',
      effect: { type: 'RENT_BOOST', remainingTurns: 2, multiplier: 1.5 }
    }
  },
  {
    id: 'rent-shield',
    name: 'Tenant Union',
    description: 'Your next two turns are protected from rent.',
    effect: { kind: 'ACTIVE_EFFECT', effect: { type: 'RENT_SHIELD', remainingTurns: 2 } }
  },
  {
    id: 'tax-immunity',
    name: 'Green Rebate',
    description: 'Ignore tax tiles for two turns.',
    effect: { kind: 'ACTIVE_EFFECT', effect: { type: 'TAX_IMMUNITY', remainingTurns: 2 } }
  },
  cash('lottery', 'Travel Lottery', 'Your ticket wins the grand prize.', 900),
  cash('permit-delay', 'Permit Delay', 'Expedited paperwork is expensive.', -240),
  cash('data-sale', 'Infrastructure Dividend', 'A city investment pays a dividend.', 220),
  cash('drone-damage', 'Storm Damage', 'Repair damage after a sudden storm.', -180),
  cash('festival-profit', 'Street Festival', 'Your pop-up stalls thrive.', 340),
  cash('power-surge', 'Utility Repairs', 'Urgent utility work hits your reserves.', -260),
  cash('patent-sale', 'Design License', 'License a clever landmark design.', 480),
  cash('audit', 'Surprise Audit', 'An accounting mismatch costs you.', -320),
  cash('viral-campaign', 'Viral Campaign', 'A campaign brings new tenants.', 290),
  cash('insurance-payout', 'Insurance Payout', 'A dormant claim is approved.', 360),
  cash('server-outage', 'Hotel Closure', 'Emergency building work is required.', -210),
  cash('night-market', 'Local Market', 'A weekend market turns a profit.', 260),
  cash('union-settlement', 'Union Settlement', 'Back pay is due.', -280),
  cash('solar-credit', 'Solar Credit', 'Clean energy earns a rebate.', 190),
  cash('art-auction', 'Street Art Auction', 'A mural investment appreciates.', 410),
  cash('parking-fines', 'Parking Fines', 'Your vehicles parked badly.', -150),
  cash('startup-exit', 'Business Sale', 'A small investment pays off.', 650),
  cash('water-leak', 'Water Leak', 'A burst pipe needs repairs.', -230),
  cash('tourism-wave', 'Tourism Wave', 'Visitors fill the city.', 330),
  cash('legal-fees', 'Zoning Appeal', 'Pay legal fees.', -270),
  cash('community-grant', 'Community Grant', 'Your public space proposal wins.', 275),
  cash('freight-delay', 'Freight Delay', 'Rerouting cargo costs money.', -195),
  cash('naming-rights', 'Naming Rights', 'A brand sponsors your plaza.', 375),
  cash('security-upgrade', 'Security Upgrade', 'Mandatory systems are installed.', -225),
  cash('creator-royalties', 'Creator Royalties', 'A licensed design keeps selling.', 245),
  cash('flash-flood', 'Flash Flood', 'Drainage repairs are urgent.', -310),
  cash('robotics-prize', 'Architecture Prize', 'Your landmark wins the jury.', 525),
  cash('noise-penalty', 'Noise Penalty', 'Your rooftop venue broke curfew.', -170),
  cash('metro-rebate', 'Metro Rebate', 'Transit usage earns a reward.', 205),
  cash('supply-glut', 'Supply Glut', 'Inventory loses value.', -200),
  cash('rare-materials', 'Commodity Surplus', 'Surplus materials find a buyer.', 315),
  cash('maintenance-week', 'Maintenance Week', 'Preventive work comes due.', -250),
  {
    id: 'city-stimulus',
    name: 'Tourism Grant',
    description: 'Every active investor receives 120.',
    effect: { kind: 'ALL_PLAYERS_CASH', amount: 120 }
  },
  {
    id: 'grid-levy',
    name: 'International Levy',
    description: 'Every active investor pays 90.',
    effect: { kind: 'ALL_PLAYERS_CASH', amount: -90 }
  },
  {
    id: 'express-loop',
    name: 'Round-the-World Ticket',
    description: 'Return directly to World Tour.',
    effect: { kind: 'MOVE', tileId: 'neon-start', collectSalary: true }
  },
  {
    id: 'detour',
    name: 'Travel Detour',
    description: 'Move to Travel Grant.',
    effect: { kind: 'MOVE', tileId: 'prism-park', collectSalary: false }
  }
] as const;

export const EVENT_DEFINITIONS_BY_ID: Readonly<Record<string, EventDefinition>> = Object.freeze(
  Object.fromEntries(EVENT_DEFINITIONS.map((event) => [event.id, event]))
);

export const NEON_EVENT_DECK: readonly string[] = EVENT_DEFINITIONS.map((event) => event.id);
