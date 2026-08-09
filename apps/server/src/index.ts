import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { buildServer } from './app.js';

for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (!existsSync(candidate)) continue;
  loadEnvFile(candidate);
  break;
}

const server = await buildServer();

try {
  await server.app.listen({ host: server.config.host, port: server.config.port });
} catch (error) {
  server.app.log.error(error);
  process.exitCode = 1;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().finally(() => process.exit(0));
  });
}

export { buildServer } from './app.js';
