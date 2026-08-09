import { PrismaClient } from '@prisma/client';

const globalDatabase = globalThis as unknown as { circuitPrisma?: PrismaClient };

export const prisma = globalDatabase.circuitPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalDatabase.circuitPrisma = prisma;

export async function connectDatabase(): Promise<boolean> {
  try {
    await prisma.$connect();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
