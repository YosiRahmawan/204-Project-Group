import { describe, expect, test } from 'vitest';
import { createApp } from './app.js';
import { parseConfig } from './config.js';

describe('foundation API', () => {
  test('health returns minimal public service status', async () => {
    const app = createApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ok',
        service: '204-project-group',
      });
    } finally {
      await app.close();
    }
  });

  test('only the configured web origin receives CORS access', async () => {
    const app = createApp();
    try {
      const allowed = await app.inject({
        url: '/health',
        headers: { origin: 'http://127.0.0.1:5173' },
      });
      expect(allowed.headers['access-control-allow-origin']).toBe(
        'http://127.0.0.1:5173',
      );
      const denied = await app.inject({
        url: '/health',
        headers: { origin: 'https://untrusted.example' },
      });
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  test('unexpected errors do not expose internal details', async () => {
    const app = createApp();
    app.get('/test-error', () => {
      throw new Error('private-diagnostic-detail');
    });
    try {
      const response = await app.inject('/test-error');
      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('private-diagnostic-detail');
    } finally {
      await app.close();
    }
  });
});

test('development config defaults to loopback and rejects invalid ports/origins', () => {
  expect(parseConfig({}).HOST).toBe('127.0.0.1');
  for (const PORT of ['0', '65536', 'text']) {
    expect(() => parseConfig({ PORT })).toThrow();
  }
  expect(() => parseConfig({ WEB_ORIGIN: '*' })).toThrow();
});
