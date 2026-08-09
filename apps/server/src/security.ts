import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);

export interface SessionClaims {
  userId: string;
  playerId: string;
  nickname: string;
  guest: boolean;
  expiresAt: number;
}

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

export function issueReconnectToken(
  claims: Omit<SessionClaims, 'expiresAt'>,
  secret: string,
  ttlMs: number
): string {
  const payload = encode(
    JSON.stringify({ ...claims, expiresAt: Date.now() + ttlMs } satisfies SessionClaims)
  );
  const signature = encode(createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${signature}`;
}

export function verifyReconnectToken(token: string, secret: string): SessionClaims | null {
  const [payload, signature, extra] = token.split('.');
  if (payload === undefined || signature === undefined || extra !== undefined) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as Partial<SessionClaims>;
    if (
      typeof claims.userId !== 'string' ||
      typeof claims.playerId !== 'string' ||
      typeof claims.nickname !== 'string' ||
      typeof claims.guest !== 'boolean' ||
      typeof claims.expiresAt !== 'number' ||
      claims.expiresAt <= Date.now()
    )
      return null;
    return claims as SessionClaims;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('base64url')}:${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltText, expectedText] = stored.split(':');
  if (algorithm !== 'scrypt' || saltText === undefined || expectedText === undefined) return false;
  const expected = Buffer.from(expectedText, 'base64url');
  const actual = (await scrypt(
    password,
    Buffer.from(saltText, 'base64url'),
    expected.length
  )) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
