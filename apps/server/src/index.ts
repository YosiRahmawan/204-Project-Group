import { createApp } from './app.js';
import { parseConfig } from './config.js';

let config;
try {
  config = parseConfig(process.env);
} catch (error) {
  console.error(
    'Server configuration is invalid. Create a .env file in the project root (see .env.example) with OWNER_PASSWORD=<at least 12 characters>.',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
const app = createApp(config, true);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch((error: unknown) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  });
}

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
