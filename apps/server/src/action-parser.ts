import type { GameAction } from '@circuit/game-engine';
import type { GameActionEnvelope, JsonValue } from '@circuit/shared';
import { z } from 'zod';

import { RequestError } from './errors.js';

const empty = z.object({}).strict();
const roll = z
  .object({ pathChoices: z.array(z.string().min(1).max(64)).max(12).optional() })
  .strict();
const property = z.object({ propertyId: z.string().min(1).max(64) }).strict();
const flightDestination = z.object({ destinationTileId: z.string().min(1).max(64) }).strict();
const roundEventCard = z.object({ cardIndex: z.number().int().min(0).max(2) }).strict();
const bid = z.object({ amount: z.number().int().positive().max(100_000_000) }).strict();
const tradeId = z.object({ tradeId: z.string().uuid() }).strict();
const assets = z
  .object({
    cash: z.number().int().min(0).max(100_000_000),
    propertyIds: z.array(z.string().min(1).max(64)).max(64),
    resources: z.array(z.string().min(1).max(64)).max(64)
  })
  .strict();
const offer = z
  .object({ recipientId: z.string().uuid(), offered: assets, requested: assets })
  .strict();
const counter = z
  .object({ tradeId: z.string().uuid(), offered: assets, requested: assets })
  .strict();

function parse<T>(schema: z.ZodType<T>, payload: JsonValue | undefined): T {
  const result = schema.safeParse(payload ?? {});
  if (!result.success) throw new RequestError('BAD_REQUEST', 'Invalid game action payload');
  return result.data;
}

export function toEngineAction(envelope: GameActionEnvelope, actorId: string): GameAction {
  const expectedRevision = envelope.expectedVersion;
  switch (envelope.type) {
    case 'START_GAME':
      return { type: 'START_GAME', actorId, expectedRevision, ...parse(empty, envelope.payload) };
    case 'ROLL_DICE': {
      const parsed = parse(roll, envelope.payload);
      return parsed.pathChoices === undefined
        ? { type: 'ROLL_DICE', actorId, expectedRevision }
        : { type: 'ROLL_DICE', actorId, expectedRevision, pathChoices: parsed.pathChoices };
    }
    case 'TAKE_FLIGHT':
      return {
        type: 'TAKE_FLIGHT',
        actorId,
        expectedRevision,
        ...parse(flightDestination, envelope.payload)
      };
    case 'DECLINE_FLIGHT':
      return {
        type: 'DECLINE_FLIGHT',
        actorId,
        expectedRevision,
        ...parse(empty, envelope.payload)
      };
    case 'REVEAL_ROUND_EVENT':
      return {
        type: 'REVEAL_ROUND_EVENT',
        actorId,
        expectedRevision,
        ...parse(roundEventCard, envelope.payload)
      };
    case 'BUY_PROPERTY':
      return { type: 'BUY_PROPERTY', actorId, expectedRevision, ...parse(empty, envelope.payload) };
    case 'DECLINE_PROPERTY':
      return {
        type: 'DECLINE_PROPERTY',
        actorId,
        expectedRevision,
        ...parse(empty, envelope.payload)
      };
    case 'END_TURN':
      return { type: 'END_TURN', actorId, expectedRevision, ...parse(empty, envelope.payload) };
    case 'BID_AUCTION':
      return { type: 'BID_AUCTION', actorId, expectedRevision, ...parse(bid, envelope.payload) };
    case 'PASS_AUCTION':
      return { type: 'PASS_AUCTION', actorId, expectedRevision, ...parse(empty, envelope.payload) };
    case 'CLOSE_AUCTION':
      return {
        type: 'CLOSE_AUCTION',
        actorId,
        expectedRevision,
        ...parse(empty, envelope.payload)
      };
    case 'MORTGAGE_PROPERTY':
      return {
        type: 'MORTGAGE_PROPERTY',
        actorId,
        expectedRevision,
        ...parse(property, envelope.payload)
      };
    case 'UNMORTGAGE_PROPERTY':
      return {
        type: 'UNMORTGAGE_PROPERTY',
        actorId,
        expectedRevision,
        ...parse(property, envelope.payload)
      };
    case 'BUILD_UPGRADE':
      return {
        type: 'BUILD_UPGRADE',
        actorId,
        expectedRevision,
        ...parse(property, envelope.payload)
      };
    case 'SELL_UPGRADE':
      return {
        type: 'SELL_UPGRADE',
        actorId,
        expectedRevision,
        ...parse(property, envelope.payload)
      };
    case 'SETTLE_DEBT':
      return { type: 'SETTLE_DEBT', actorId, expectedRevision, ...parse(empty, envelope.payload) };
    case 'DECLARE_BANKRUPTCY':
      return {
        type: 'DECLARE_BANKRUPTCY',
        actorId,
        expectedRevision,
        ...parse(empty, envelope.payload)
      };
    case 'FORFEIT_GAME':
      return {
        type: 'FORFEIT_GAME',
        actorId,
        expectedRevision,
        ...parse(empty, envelope.payload)
      };
    case 'OFFER_TRADE':
      return { type: 'OFFER_TRADE', actorId, expectedRevision, ...parse(offer, envelope.payload) };
    case 'ACCEPT_TRADE':
      return {
        type: 'ACCEPT_TRADE',
        actorId,
        expectedRevision,
        ...parse(tradeId, envelope.payload)
      };
    case 'DECLINE_TRADE':
      return {
        type: 'DECLINE_TRADE',
        actorId,
        expectedRevision,
        ...parse(tradeId, envelope.payload)
      };
    case 'CANCEL_TRADE':
      return {
        type: 'CANCEL_TRADE',
        actorId,
        expectedRevision,
        ...parse(tradeId, envelope.payload)
      };
    case 'COUNTER_TRADE':
      return {
        type: 'COUNTER_TRADE',
        actorId,
        expectedRevision,
        ...parse(counter, envelope.payload)
      };
    default:
      throw new RequestError('BAD_REQUEST', `Unsupported game action: ${envelope.type}`);
  }
}
