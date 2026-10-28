import { z } from 'zod';

const configSchema = z.object({
  HOST: z.enum(['127.0.0.1', '::1']).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
    }, 'Expected an HTTP(S) origin without a path')
    .default('http://127.0.0.1:5173'),
  // The only login: Leo's password. There is no default; the server will not start without it.
  OWNER_PASSWORD: z
    .string()
    .min(12, 'OWNER_PASSWORD must have at least 12 characters'),
  // Relative paths are resolved from the folder the server is started in.
  DATABASE_PATH: z.string().default('data/204.db'),
  UPLOAD_DIR: z.string().default('data/uploads'),
  // Set to true only behind a reverse proxy you control; the client address then comes from it.
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Model registry file; the default is apps/server/models.registry.json.
  // An existing Obsidian vault used as shared memory; unset means memory is off.
  OBSIDIAN_VAULT_PATH: z.string().optional(),
  // Hermes API server (OpenAI-compatible). Loopback only, so its key can never be sent elsewhere.
  HERMES_API_URL: z
    .url()
    .refine(
      (value) =>
        ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname),
      'HERMES_API_URL must point to this machine (127.0.0.1 or localhost)',
    )
    .optional(),
  HERMES_API_KEY: z.string().min(16).optional(),
  MODEL_REGISTRY_PATH: z.string().optional(),
  SESSION_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export function parseConfig(env: Record<string, string | undefined>) {
  return configSchema.parse(env);
}

export type Config = ReturnType<typeof parseConfig>;
