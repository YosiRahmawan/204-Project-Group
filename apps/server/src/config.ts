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
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export function parseConfig(env: Record<string, string | undefined>) {
  return configSchema.parse(env);
}
