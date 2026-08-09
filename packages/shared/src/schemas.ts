import { z } from 'zod';

import { GAME_MODES, ROOM_VISIBILITIES, VICTORY_MODES } from './types.js';

export const nicknameSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(/^[\p{L}\p{N} _.-]+$/u, 'Nickname contains unsupported characters');

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{6}$/);
export const roomPasswordSchema = z.string().min(4).max(72);
export const idSchema = z.string().uuid();

export const roomRulesSchema = z
  .object({
    startingCash: z.number().int().min(500).max(1_000_000).default(1_500),
    turnTimerSeconds: z
      .union([z.literal(0), z.literal(15), z.literal(30), z.literal(45), z.literal(60)])
      .default(45),
    victoryMode: z.enum(VICTORY_MODES).default('LAST_PLAYER_STANDING'),
    maxRounds: z.number().int().min(5).max(500).nullable().default(null),
    netWorthTarget: z.number().int().min(1_000).max(100_000_000).nullable().default(null),
    auctionsEnabled: z.boolean().default(true),
    tradesEnabled: z.boolean().default(true),
    economicEventsEnabled: z.boolean().default(true),
    doublesExtraRoll: z.boolean().default(true)
  })
  .strict();

export const roomSettingsSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    visibility: z.enum(ROOM_VISIBILITIES),
    maxPlayers: z.number().int().min(2).max(8),
    mapId: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    mode: z.enum(GAME_MODES),
    allowSpectators: z.boolean(),
    rules: roomRulesSchema
  })
  .strict();

export const createSessionSchema = z.object({ nickname: nicknameSchema }).strict();
export const resumeSessionSchema = z
  .object({ reconnectToken: z.string().min(32).max(2048) })
  .strict();

export const listRoomsSchema = z
  .object({
    mode: z.enum(GAME_MODES).optional(),
    mapId: z.string().trim().min(2).max(64).optional(),
    onlyJoinable: z.boolean().default(true),
    limit: z.number().int().min(1).max(100).default(30)
  })
  .strict();

export const createRoomSchema = z
  .object({
    settings: roomSettingsSchema,
    password: roomPasswordSchema.optional(),
    replaceExisting: z.boolean().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.settings.visibility === 'PRIVATE' && value.password === undefined) return;
    if (value.settings.visibility === 'PUBLIC' && value.password !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Public rooms cannot have a password'
      });
    }
  });

export const joinRoomSchema = z
  .object({
    code: roomCodeSchema,
    password: roomPasswordSchema.optional(),
    asSpectator: z.boolean().default(false),
    replaceExisting: z.boolean().optional()
  })
  .strict();

export const quickPlaySchema = z
  .object({
    mode: z.enum(GAME_MODES).default('CLASSIC'),
    mapId: z.string().trim().min(2).max(64).default('neon-city'),
    maxPlayers: z.number().int().min(2).max(8).default(4),
    replaceExisting: z.boolean().optional()
  })
  .strict();

export const leaveRoomSchema = z.object({ roomId: idSchema }).strict();
export const readySchema = z.object({ roomId: idSchema, ready: z.boolean() }).strict();

export const playerCustomizationSchema = z
  .object({
    avatarId: z.string().trim().min(1).max(64).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    tokenId: z.string().trim().min(1).max(64).optional(),
    emoteId: z.string().trim().min(1).max(64).optional()
  })
  .strict();

export const updatePlayerSchema = z
  .object({ roomId: idSchema, customization: playerCustomizationSchema })
  .strict();
export const updateSettingsSchema = z
  .object({ roomId: idSchema, settings: roomSettingsSchema })
  .strict();
export const startGameSchema = z.object({ roomId: idSchema }).strict();
export const rematchSchema = z.object({ roomId: idSchema }).strict();
export const kickPlayerSchema = z.object({ roomId: idSchema, playerId: idSchema }).strict();
export const transferHostSchema = z.object({ roomId: idSchema, playerId: idSchema }).strict();

export const gameActionSchema = z
  .object({
    roomId: idSchema,
    action: z
      .object({
        actionId: idSchema,
        expectedVersion: z.number().int().nonnegative(),
        type: z
          .string()
          .trim()
          .min(1)
          .max(64)
          .regex(/^[A-Z][A-Z0-9_]*$/),
        payload: z.json().optional()
      })
      .strict()
  })
  .strict();

export const chatMessageSchema = z
  .object({ roomId: idSchema, text: z.string().trim().min(1).max(280) })
  .strict();

export const emoteSchema = z
  .object({ roomId: idSchema, emoteId: z.string().trim().min(1).max(64) })
  .strict();

export const pingSchema = z.object({ sentAt: z.number().int().nonnegative() }).strict();

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type ResumeSessionInput = z.infer<typeof resumeSessionSchema>;
export type ListRoomsInput = z.infer<typeof listRoomsSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type QuickPlayInput = z.infer<typeof quickPlaySchema>;
export type LeaveRoomInput = z.infer<typeof leaveRoomSchema>;
export type ReadyInput = z.infer<typeof readySchema>;
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type StartGameInput = z.infer<typeof startGameSchema>;
export type RematchInput = z.infer<typeof rematchSchema>;
export type KickPlayerInput = z.infer<typeof kickPlayerSchema>;
export type TransferHostInput = z.infer<typeof transferHostSchema>;
export type GameActionInput = z.infer<typeof gameActionSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type EmoteInput = z.infer<typeof emoteSchema>;
export type PingInput = z.infer<typeof pingSchema>;
