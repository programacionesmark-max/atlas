export interface ServerConfig {
  host: string;
  port: number;
  corsOrigins: string[];
  sessionSecret: string;
  reconnectTtlMs: number;
  disconnectGraceMs: number;
  snapshotEveryActions: number;
  databaseEnabled: boolean;
  databaseRequired: boolean;
  serveWeb: boolean;
  webDistPath: string;
  logLevel: 'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

const OFFICIAL_WEB_ORIGINS = ['https://atlas-estates-world.vercel.app'] as const;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadServerConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseEnabled = overrides.databaseEnabled ?? process.env.DATABASE_DISABLED !== 'true';
  const sessionSecret =
    process.env.SESSION_SECRET ??
    (isProduction ? '' : 'local-circuit-estates-session-secret-change-me');
  if (sessionSecret.length < 32)
    throw new Error('SESSION_SECRET must contain at least 32 characters');

  const configuredCorsOrigins = (
    process.env.CORS_ORIGINS ?? (isProduction ? 'http://localhost:5173,http://127.0.0.1:5173' : '*')
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const corsOrigins = isProduction
    ? [...new Set([...configuredCorsOrigins, ...OFFICIAL_WEB_ORIGINS])]
    : configuredCorsOrigins;

  return {
    host: overrides.host ?? process.env.HOST ?? '0.0.0.0',
    port: overrides.port ?? positiveInteger(process.env.PORT, 3001),
    corsOrigins: overrides.corsOrigins ?? corsOrigins,
    sessionSecret: overrides.sessionSecret ?? sessionSecret,
    reconnectTtlMs:
      overrides.reconnectTtlMs ??
      positiveInteger(process.env.RECONNECT_TTL_MS, 7 * 24 * 60 * 60 * 1000),
    disconnectGraceMs:
      overrides.disconnectGraceMs ?? positiveInteger(process.env.DISCONNECT_GRACE_MS, 15_000),
    snapshotEveryActions:
      overrides.snapshotEveryActions ?? positiveInteger(process.env.SNAPSHOT_EVERY_ACTIONS, 10),
    databaseEnabled,
    databaseRequired:
      overrides.databaseRequired ??
      (process.env.DATABASE_REQUIRED === 'true' || (isProduction && databaseEnabled)),
    serveWeb: overrides.serveWeb ?? process.env.SERVE_WEB === 'true',
    webDistPath: overrides.webDistPath ?? process.env.WEB_DIST_PATH ?? 'apps/web/dist',
    logLevel:
      overrides.logLevel ??
      (process.env.LOG_LEVEL as ServerConfig['logLevel'] | undefined) ??
      'info'
  };
}
