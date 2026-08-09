import type { RoomSettings } from '@circuit/shared';
import { describe, expect, it } from 'vitest';

import { modeRules } from '../src/room-manager.js';

const base: RoomSettings = {
  name: 'Modes',
  visibility: 'PUBLIC',
  maxPlayers: 4,
  mapId: 'neon-city',
  mode: 'CLASSIC',
  allowSpectators: true,
  rules: {
    startingCash: 3200,
    turnTimerSeconds: 45,
    victoryMode: 'LAST_PLAYER_STANDING',
    maxRounds: 30,
    netWorthTarget: null,
    auctionsEnabled: true,
    tradesEnabled: true,
    economicEventsEnabled: true,
    doublesExtraRoll: true
  }
};

describe('authoritative mode profiles', () => {
  it('gives every advertised mode a distinct functional rule', () => {
    expect(modeRules({ ...base, mode: 'BLITZ' })).toMatchObject({
      maxRounds: 12,
      auctionDurationMs: 12000
    });
    expect(modeRules({ ...base, mode: 'CHAOS' })).toMatchObject({
      roundCashSwing: 350,
      rentMultiplier: 1.25
    });
    expect(modeRules({ ...base, mode: 'TYCOON' })).toMatchObject({
      maxUpgradeLevel: 5,
      netWorthTarget: 12000
    });
    expect(modeRules({ ...base, mode: 'TEAMS' })).toMatchObject({ victoryMode: 'TEAM_NET_WORTH' });
    expect(modeRules({ ...base, mode: 'BATTLE_ROYALE' })).toMatchObject({ roundLevy: 250 });
    expect(modeRules({ ...base, mode: 'DUEL' })).toMatchObject({
      maxRounds: 16,
      rentMultiplier: 1.15
    });
    expect(modeRules({ ...base, mode: 'LAND_RUSH' })).toMatchObject({
      propertyPriceMultiplier: 0.7
    });
  });

  it('keeps custom settings untouched', () => {
    expect(
      modeRules({ ...base, mode: 'CUSTOM', rules: { ...base.rules, startingCash: 7777 } })
    ).toMatchObject({ startingCash: 7777, maxRounds: 30 });
  });
});
