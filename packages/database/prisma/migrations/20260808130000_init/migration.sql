-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "RoomVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('LOBBY', 'STARTING', 'IN_GAME', 'FINISHED');

-- CreateEnum
CREATE TYPE "RoomMemberRole" AS ENUM ('PLAYER', 'SPECTATOR');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('STARTING', 'ACTIVE', 'PAUSED', 'FINISHED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('CLASSIC', 'BLITZ', 'CHAOS', 'TYCOON', 'TEAMS', 'BATTLE_ROYALE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "GamePlayerStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'BANKRUPT', 'SPECTATING', 'FINISHED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INITIAL_GRANT', 'BANK_DEPOSIT', 'BANK_WITHDRAWAL', 'PLAYER_TRANSFER', 'PROPERTY_PURCHASE', 'PROPERTY_SALE', 'RENT', 'TAX', 'REWARD', 'FINE', 'MORTGAGE', 'UNMORTGAGE', 'UPGRADE_PURCHASE', 'UPGRADE_SALE', 'AUCTION_PURCHASE', 'TRADE', 'LOAN', 'LOAN_REPAYMENT', 'INTEREST', 'EVENT', 'BANKRUPTCY_TRANSFER');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CosmeticType" AS ENUM ('TOKEN', 'DICE', 'TRAIL', 'AVATAR', 'BOARD_EFFECT', 'EMOTE', 'VICTORY_ANIMATION');

-- CreateEnum
CREATE TYPE "CosmeticRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320),
    "passwordHash" VARCHAR(255),
    "username" VARCHAR(24) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(40) NOT NULL,
    "avatarId" VARCHAR(64) NOT NULL DEFAULT 'avatar-orbit',
    "bio" VARCHAR(240),
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "mmr" INTEGER NOT NULL DEFAULT 1000,
    "favoriteMap" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "code" CHAR(6) NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "hostUserId" UUID NOT NULL,
    "visibility" "RoomVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "RoomStatus" NOT NULL DEFAULT 'LOBBY',
    "passwordHash" VARCHAR(255),
    "maxPlayers" INTEGER NOT NULL,
    "mapId" VARCHAR(64) NOT NULL,
    "mode" "GameMode" NOT NULL,
    "allowSpectators" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMember" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "nickname" VARCHAR(24) NOT NULL,
    "role" "RoomMemberRole" NOT NULL DEFAULT 'PLAYER',
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "customization" JSONB NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapDefinition" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "definition" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "mapId" VARCHAR(64) NOT NULL,
    "mapVersion" INTEGER NOT NULL DEFAULT 1,
    "mode" "GameMode" NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'STARTING',
    "rules" JSONB NOT NULL,
    "engineVersion" VARCHAR(32) NOT NULL,
    "seedCommitment" CHAR(64),
    "currentRevision" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlayer" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "userId" UUID,
    "playerId" UUID NOT NULL,
    "seat" INTEGER NOT NULL,
    "nickname" VARCHAR(24) NOT NULL,
    "status" "GamePlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "team" INTEGER,
    "finalCash" INTEGER,
    "finalNetWorth" INTEGER,
    "placement" INTEGER,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "actorPlayerId" UUID,
    "actionId" UUID,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "fromGamePlayerId" UUID,
    "toGamePlayerId" UUID,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER,
    "balanceAfter" INTEGER,
    "propertyId" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSnapshot" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "eventSequence" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "state" JSONB NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "winnerPlayerId" UUID,
    "victoryReason" VARCHAR(64) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "roundsPlayed" INTEGER NOT NULL,
    "recap" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResultPlayer" (
    "id" UUID NOT NULL,
    "matchResultId" UUID NOT NULL,
    "gamePlayerId" UUID NOT NULL,
    "placement" INTEGER NOT NULL,
    "cash" INTEGER NOT NULL,
    "netWorth" INTEGER NOT NULL,
    "rentEarned" INTEGER NOT NULL DEFAULT 0,
    "propertiesOwned" INTEGER NOT NULL DEFAULT 0,
    "propertiesPurchased" INTEGER NOT NULL DEFAULT 0,
    "tradesCompleted" INTEGER NOT NULL DEFAULT 0,
    "biggestTransaction" INTEGER NOT NULL DEFAULT 0,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "mmrDelta" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatchResultPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStatistics" (
    "userId" UUID NOT NULL,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "totalMoneyEarned" BIGINT NOT NULL DEFAULT 0,
    "biggestFortune" INTEGER NOT NULL DEFAULT 0,
    "propertiesPurchased" INTEGER NOT NULL DEFAULT 0,
    "bankruptcies" INTEGER NOT NULL DEFAULT 0,
    "tradesCompleted" INTEGER NOT NULL DEFAULT 0,
    "rentCollected" BIGINT NOT NULL DEFAULT 0,
    "currentWinStreak" INTEGER NOT NULL DEFAULT 0,
    "bestWinStreak" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStatistics_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "addresseeId" UUID NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecentPlayer" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "opponentId" UUID NOT NULL,
    "lastGameId" UUID,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 1,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecentPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cosmetic" (
    "id" VARCHAR(64) NOT NULL,
    "type" "CosmeticType" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "rarity" "CosmeticRarity" NOT NULL DEFAULT 'COMMON',
    "assetKey" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "userId" UUID NOT NULL,
    "cosmeticId" VARCHAR(64) NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(40) NOT NULL,

    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("userId","cosmeticId")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "subjectUserId" UUID,
    "gameId" UUID,
    "category" VARCHAR(40) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "evidence" JSONB,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_isGuest_lastSeenAt_idx" ON "User"("isGuest", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE INDEX "Room_visibility_status_createdAt_idx" ON "Room"("visibility", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Room_status_lastActivityAt_idx" ON "Room"("status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "RoomMember_playerId_idx" ON "RoomMember"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_userId_key" ON "RoomMember"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_playerId_key" ON "RoomMember"("roomId", "playerId");

-- CreateIndex
CREATE INDEX "Game_roomId_status_idx" ON "Game"("roomId", "status");

-- CreateIndex
CREATE INDEX "Game_status_updatedAt_idx" ON "Game"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "GamePlayer_userId_createdAt_idx" ON "GamePlayer"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_playerId_key" ON "GamePlayer"("gameId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_seat_key" ON "GamePlayer"("gameId", "seat");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_revision_idx" ON "GameEvent"("gameId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_gameId_sequence_key" ON "GameEvent"("gameId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_gameId_actionId_key" ON "GameEvent"("gameId", "actionId");

-- CreateIndex
CREATE INDEX "Transaction_fromGamePlayerId_createdAt_idx" ON "Transaction"("fromGamePlayerId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_toGamePlayerId_createdAt_idx" ON "Transaction"("toGamePlayerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_gameId_sequence_key" ON "Transaction"("gameId", "sequence");

-- CreateIndex
CREATE INDEX "GameSnapshot_gameId_createdAt_idx" ON "GameSnapshot"("gameId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameSnapshot_gameId_revision_key" ON "GameSnapshot"("gameId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_gameId_key" ON "MatchResult"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResultPlayer_gamePlayerId_key" ON "MatchResultPlayer"("gamePlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResultPlayer_matchResultId_placement_key" ON "MatchResultPlayer"("matchResultId", "placement");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "RecentPlayer_userId_lastPlayedAt_idx" ON "RecentPlayer"("userId", "lastPlayedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecentPlayer_userId_opponentId_key" ON "RecentPlayer"("userId", "opponentId");

-- CreateIndex
CREATE INDEX "UserCosmetic_userId_equipped_idx" ON "UserCosmetic"("userId", "equipped");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_subjectUserId_createdAt_idx" ON "Report"("subjectUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "MapDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fromGamePlayerId_fkey" FOREIGN KEY ("fromGamePlayerId") REFERENCES "GamePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_toGamePlayerId_fkey" FOREIGN KEY ("toGamePlayerId") REFERENCES "GamePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSnapshot" ADD CONSTRAINT "GameSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResultPlayer" ADD CONSTRAINT "MatchResultPlayer_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "MatchResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResultPlayer" ADD CONSTRAINT "MatchResultPlayer_gamePlayerId_fkey" FOREIGN KEY ("gamePlayerId") REFERENCES "GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStatistics" ADD CONSTRAINT "UserStatistics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentPlayer" ADD CONSTRAINT "RecentPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentPlayer" ADD CONSTRAINT "RecentPlayer_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "Cosmetic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
