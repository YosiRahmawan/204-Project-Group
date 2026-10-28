import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, test } from 'vitest';
import { createApp } from './app.js';
import { parseConfig } from './config.js';

const password = 'correct-horse-battery';
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const dirs: string[] = [];
const apps: ReturnType<typeof createApp>[] = [];

// A fresh app with its own folder; pass the same folder again to "restart" the server.
function start(
  folder = mkdtempSync(join(tmpdir(), 'office-')),
  extra: Record<string, string> = {},
) {
  if (!dirs.includes(folder)) dirs.push(folder);
  const app = createApp(
    parseConfig({
      OWNER_PASSWORD: password,
      DATABASE_PATH: join(folder, 'office.db'),
      UPLOAD_DIR: join(folder, 'uploads'),
      ...extra,
    }),
  );
  apps.push(app);
  return { app, folder };
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  dirs
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

const mutating = { 'x-requested-with': '204' };
async function login(app: ReturnType<typeof createApp>) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: mutating,
    payload: { password },
  });
  expect(response.statusCode).toBe(200);
  return String(response.headers['set-cookie']).split(';')[0]!;
}
const call = (
  app: ReturnType<typeof createApp>,
  cookie: string,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  payload?: object,
) =>
  app.inject({
    method,
    url,
    headers: { cookie, ...mutating },
    ...(payload ? { payload } : {}),
  });

describe('public surface', () => {
  test('health returns minimal public service status without a login', async () => {
    const { app } = start();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: '204-project-group',
    });
  });

  test('only the configured web origin receives CORS access', async () => {
    const { app } = start();
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
  });

  test('unexpected errors do not expose internal details', async () => {
    const { app } = start();
    app.get('/test-error', () => {
      throw new Error('private-diagnostic-detail');
    });
    const cookie = await login(app);
    const response = await app.inject({
      url: '/test-error',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('private-diagnostic-detail');
  });
});

describe('configuration', () => {
  test('defaults to loopback and rejects invalid ports, origins and short passwords', () => {
    expect(parseConfig({ OWNER_PASSWORD: password }).HOST).toBe('127.0.0.1');
    for (const PORT of ['0', '65536', 'text'])
      expect(() => parseConfig({ OWNER_PASSWORD: password, PORT })).toThrow();
    expect(() =>
      parseConfig({ OWNER_PASSWORD: password, WEB_ORIGIN: '*' }),
    ).toThrow();
    expect(() => parseConfig({})).toThrow();
    expect(() => parseConfig({ OWNER_PASSWORD: 'too-short' })).toThrow();
  });
});

describe('login', () => {
  test('everything except health and login needs a session', async () => {
    const { app } = start();
    for (const url of [
      '/tasks',
      '/auth/me',
      '/files/00000000-0000-4000-8000-000000000000',
    ])
      expect((await app.inject({ url })).statusCode).toBe(401);
  });

  test('a wrong password is refused, the right one sets a strict http-only cookie', async () => {
    const { app } = start();
    const bad = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: mutating,
      payload: { password: 'wrong-password-123' },
    });
    expect(bad.statusCode).toBe(401);
    const good = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: mutating,
      payload: { password },
    });
    const cookie = String(good.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(
      (await call(app, cookie.split(';')[0]!, 'GET', '/auth/me')).json(),
    ).toEqual({ owner: 'Leo' });
  });

  test('five wrong passwords lock the address for a minute, even for the right password', async () => {
    const { app } = start();
    for (let i = 0; i < 5; i++)
      await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: mutating,
        payload: { password: 'wrong-password-123' },
      });
    const locked = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: mutating,
      payload: { password },
    });
    expect(locked.statusCode).toBe(429);
  });

  test('changing data without the custom header is refused, and logout ends the session', async () => {
    const { app } = start();
    const cookie = await login(app);
    const noHeader = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { instruction: 'x' },
    });
    expect(noHeader.statusCode).toBe(403);
    await call(app, cookie, 'POST', '/auth/logout');
    expect((await call(app, cookie, 'GET', '/tasks')).statusCode).toBe(401);
  });
});

describe('tasks', () => {
  test('a task goes through the workflow and is still there after a restart', async () => {
    const first = start();
    const cookie = await login(first.app);
    const created = await call(first.app, cookie, 'POST', '/tasks', {
      instruction: 'Buat konten Instagram',
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().id).toBe('T-001');
    for (let i = 0; i < 4; i++)
      await call(first.app, cookie, 'POST', '/tasks/1/advance');
    const approved = await call(
      first.app,
      cookie,
      'POST',
      '/tasks/1/decision',
      { decision: 'approve', version: 1 },
    );
    expect(approved.json().status).toBe('selesai');
    await first.app.close();

    const second = start(first.folder);
    const again = await login(second.app);
    const list = (await call(second.app, again, 'GET', '/tasks')).json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 'T-001',
      status: 'selesai',
      owner: 'Aeri',
      version: 1,
    });
    expect(list[0].history).toHaveLength(6);
  });

  test('numbers keep counting and refused steps are conflicts, not crashes', async () => {
    const { app } = start();
    const cookie = await login(app);
    await call(app, cookie, 'POST', '/tasks', { instruction: 'Satu' });
    const second = await call(app, cookie, 'POST', '/tasks', {
      instruction: 'Dua',
    });
    expect(second.json().number).toBe(2);
    expect(
      (await call(app, cookie, 'POST', '/tasks', { instruction: '   ' }))
        .statusCode,
    ).toBe(400);
    // Deciding before the result is ready, and on a stale version.
    expect(
      (
        await call(app, cookie, 'POST', '/tasks/2/decision', {
          decision: 'approve',
          version: 0,
        })
      ).statusCode,
    ).toBe(409);
    for (let i = 0; i < 4; i++)
      await call(app, cookie, 'POST', '/tasks/2/advance');
    expect(
      (
        await call(app, cookie, 'POST', '/tasks/2/decision', {
          decision: 'approve',
          version: 9,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await call(app, cookie, 'POST', '/tasks/2/advance')).statusCode,
    ).toBe(409);
    expect(
      (await call(app, cookie, 'POST', '/tasks/99/advance')).statusCode,
    ).toBe(404);
    expect(
      (await call(app, cookie, 'POST', '/tasks/abc/advance')).statusCode,
    ).toBe(404);
    expect(
      (
        await call(app, cookie, 'POST', '/tasks/2/decision', {
          decision: 'nope',
          version: 1,
        })
      ).statusCode,
    ).toBe(400);
  });

  test('sample data can be added and cleared', async () => {
    const { app } = start();
    const cookie = await login(app);
    expect((await call(app, cookie, 'POST', '/tasks/demo')).json()).toEqual({
      added: 8,
    });
    expect((await call(app, cookie, 'GET', '/tasks')).json()).toHaveLength(8);
    expect((await call(app, cookie, 'DELETE', '/tasks')).statusCode).toBe(204);
    expect((await call(app, cookie, 'GET', '/tasks')).json()).toEqual([]);
  });
});

describe('files', () => {
  const upload = (
    app: ReturnType<typeof createApp>,
    cookie: string,
    bytes: Buffer,
    name: string,
  ) =>
    app.inject({
      method: 'POST',
      url: '/files',
      headers: {
        cookie,
        ...mutating,
        'content-type': 'application/octet-stream',
        'x-file-name': encodeURIComponent(name),
      },
      payload: bytes,
    });

  test('a real photo is stored, attached to a task and served safely', async () => {
    const { app } = start();
    const cookie = await login(app);
    const file = (await upload(app, cookie, png, 'foto.png')).json();
    expect(file).toMatchObject({
      name: 'foto.png',
      type: 'image/png',
      size: png.length,
    });
    const task = await call(app, cookie, 'POST', '/tasks', {
      instruction: '',
      fileIds: [file.id],
    });
    expect(task.statusCode).toBe(201);
    expect(task.json().attachments).toEqual([file]);
    const served = await call(app, cookie, 'GET', `/files/${file.id}`);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.rawPayload.equals(png)).toBe(true);
    // The same file cannot be attached twice.
    const reuse = await call(app, cookie, 'POST', '/tasks', {
      instruction: 'lagi',
      fileIds: [file.id],
    });
    expect(reuse.statusCode).toBe(400);
  });

  test('a program renamed to a photo or document is refused by its content', async () => {
    const { app } = start();
    const cookie = await login(app);
    const program = Buffer.from('MZ\x90\x00this is a windows program');
    expect((await upload(app, cookie, program, 'foto.png')).statusCode).toBe(
      415,
    );
    expect((await upload(app, cookie, program, 'laporan.pdf')).statusCode).toBe(
      415,
    );
    expect(
      (await upload(app, cookie, Buffer.from('PK\x03\x04zip'), 'arsip.zip'))
        .statusCode,
    ).toBe(415);
  });

  test('empty and oversized uploads are refused', async () => {
    const { app } = start();
    const cookie = await login(app);
    expect(
      (await upload(app, cookie, Buffer.alloc(0), 'a.png')).statusCode,
    ).toBe(400);
    const huge = Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024)]);
    expect((await upload(app, cookie, huge, 'besar.png')).statusCode).toBe(413);
  });
});

describe('sessions', () => {
  test('a login survives a server restart, and only a hash of the token is stored', async () => {
    const first = start();
    const cookie = await login(first.app);
    await first.app.close();
    const second = start(first.folder);
    expect((await call(second.app, cookie, 'GET', '/auth/me')).statusCode).toBe(
      200,
    );
    const check = new DatabaseSync(join(first.folder, 'office.db'));
    const stored = check.prepare('SELECT token_hash FROM sessions').all() as {
      token_hash: string;
    }[];
    check.close();
    expect(stored).toHaveLength(1);
    expect(cookie).not.toContain(stored[0]!.token_hash);
    expect(stored[0]!.token_hash).toHaveLength(64);
  });
});

describe('audit trail', () => {
  test('logins, task steps and uploads are recorded, newest first, and survive clearing tasks', async () => {
    const { app } = start();
    await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: mutating,
      payload: { password: 'wrong-password-123' },
    });
    const cookie = await login(app);
    await call(app, cookie, 'POST', '/tasks', { instruction: 'Satu' });
    await call(app, cookie, 'POST', '/tasks/1/advance');
    await call(app, cookie, 'DELETE', '/tasks');
    const entries = (await call(app, cookie, 'GET', '/audit')).json() as {
      action: string;
      detail: string;
      actor: string;
    }[];
    expect(entries.map((e) => e.action)).toEqual([
      'tasks.clear',
      'task.advance',
      'task.create',
      'login.ok',
      'login.bad',
    ]);
    expect(entries[1]).toMatchObject({
      actor: 'Leo',
      detail: 'T-001 analisis',
    });
    expect(entries.at(-1)!.actor).toBe('anonim');
  });
});

describe('double clicks and retries', () => {
  test('the same idempotency key creates one task and repeats the first answer', async () => {
    const { app } = start();
    const cookie = await login(app);
    const send = () =>
      app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { cookie, ...mutating, 'idempotency-key': 'klik-ganda-0001' },
        payload: { instruction: 'Sekali saja' },
      });
    const [a, b] = [await send(), await send()];
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(b.json()).toEqual(a.json());
    expect((await call(app, cookie, 'GET', '/tasks')).json()).toHaveLength(1);
  });

  test('a second advance from the same stage is a conflict, so one click means one step', async () => {
    const { app } = start();
    const cookie = await login(app);
    await call(app, cookie, 'POST', '/tasks', { instruction: 'Satu' });
    const first = await call(app, cookie, 'POST', '/tasks/1/advance', {
      from: 'dikirim',
    });
    const second = await call(app, cookie, 'POST', '/tasks/1/advance', {
      from: 'dikirim',
    });
    expect(first.json().status).toBe('analisis');
    expect(second.statusCode).toBe(409);
    expect(
      (await call(app, cookie, 'GET', '/tasks')).json()[0].history,
    ).toHaveLength(2);
  });
});

describe('live updates', () => {
  test('an open event stream is told when a task changes', async () => {
    const { app } = start();
    const cookie = await login(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
    const stop = new AbortController();
    const stream = await fetch(`${base}/events`, {
      headers: { cookie },
      signal: stop.signal,
    });
    expect(stream.headers.get('content-type')).toBe('text/event-stream');
    const reader = stream.body!.getReader();
    const read = async () =>
      new TextDecoder().decode((await reader.read()).value);
    expect(await read()).toContain('retry');
    await fetch(`${base}/tasks`, {
      method: 'POST',
      headers: { cookie, ...mutating, 'content-type': 'application/json' },
      body: JSON.stringify({ instruction: 'Ada kabar baru' }),
    });
    expect(await read()).toContain('event: changed');
    stop.abort();
  });

  test('the stream needs a login', async () => {
    const { app } = start();
    expect((await app.inject({ url: '/events' })).statusCode).toBe(401);
  });
});

describe('transport', () => {
  test('every answer carries security headers; HSTS and secure cookies only for an https origin', async () => {
    const plain = start();
    const health = await plain.app.inject({ url: '/health' });
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['x-frame-options']).toBe('DENY');
    expect(health.headers['strict-transport-security']).toBeUndefined();
    const secure = start(undefined, { WEB_ORIGIN: 'https://kantor.example' });
    expect(
      (await secure.app.inject({ url: '/health' })).headers[
        'strict-transport-security'
      ],
    ).toMatch(/max-age/);
    const response = await secure.app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: mutating,
      payload: { password },
    });
    expect(String(response.headers['set-cookie'])).toMatch(/Secure/);
  });

  test('behind a trusted proxy each client address has its own login limit', async () => {
    const { app } = start(undefined, { TRUST_PROXY: 'true' });
    const attempt = (address: string, pw: string) =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { ...mutating, 'x-forwarded-for': address },
        payload: { password: pw },
      });
    for (let i = 0; i < 5; i++) await attempt('10.0.0.1', 'wrong-password-123');
    expect((await attempt('10.0.0.1', password)).statusCode).toBe(429);
    expect((await attempt('10.0.0.2', password)).statusCode).toBe(200);
  });
});
