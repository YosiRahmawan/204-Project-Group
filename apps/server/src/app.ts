import Fastify from 'fastify';
import cors from '@fastify/cors';
import { parseConfig } from './config.js';

export function createApp(config = parseConfig({}), logging = false) {
  const app = Fastify({
    logger: logging
      ? {
          level: config.LOG_LEVEL,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        }
      : false,
    bodyLimit: 64 * 1024,
  });

  app.register(cors, {
    origin: [config.WEB_ORIGIN],
    methods: ['GET'],
    credentials: false,
  });

  app.get('/health', () => ({ status: 'ok', service: '204-project-group' }));

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Request failed');
    const candidate =
      error instanceof Error && 'statusCode' in error
        ? error.statusCode
        : undefined;
    const statusCode =
      typeof candidate === 'number' && candidate >= 400 && candidate < 500
        ? candidate
        : 500;
    reply.code(statusCode).send({
      error: statusCode === 500 ? 'Internal Server Error' : 'Request rejected',
      requestId: request.id,
    });
  });

  return app;
}
