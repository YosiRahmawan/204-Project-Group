import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp } from './app.js';
import { parseConfig } from './config.js';

const password = 'correct-horse-battery';
const hermesKey = 'hermes-test-key-0123456789';
const headers = { 'x-requested-with': '204' };
const dirs: string[] = [];
const apps: ReturnType<typeof createApp>[] = [];

type Fake = {
  toolsets?: { name: string; enabled: boolean }[];
  chat?: () => Promise<Response> | Response;
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// A stand-in for the Hermes API server.
function fakeHermes(fake: Fake = {}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const auth = (init?.headers as Record<string, string> | undefined)
      ?.authorization;
    if (auth !== `Bearer ${hermesKey}`) return json({ error: 'bad key' }, 401);
    if (url.endsWith('/v1/models')) return json({ data: [{ id: 'akira' }] });
    if (url.endsWith('/v1/toolsets'))
      return json({
        data: fake.toolsets ?? [
          { name: 'terminal', enabled: false },
          { name: 'search', enabled: false },
        ],
      });
    if (url.endsWith('/v1/chat/completions'))
      return (
        fake.chat?.() ??
        json({
          model: 'akira',
          choices: [
            { message: { content: 'Saya Akira, melapor kepada Leo.' } },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120,
          },
        })
      );
    return json({}, 404);
  });
}

async function session(
  fetchImpl: typeof fetch | undefined,
  env: Record<string, string> = {
    HERMES_API_URL: 'http://127.0.0.1:8643',
    HERMES_API_KEY: hermesKey,
  },
) {
  const folder = mkdtempSync(join(tmpdir(), 'akira-'));
  dirs.push(folder);
  const app = createApp(
    parseConfig({
      OWNER_PASSWORD: password,
      DATABASE_PATH: join(folder, 'o.db'),
      UPLOAD_DIR: join(folder, 'up'),
      ...env,
    }),
    false,
    fetchImpl,
  );
  apps.push(app);
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers,
    payload: { password },
  });
  const cookie = String(login.headers['set-cookie']).split(';')[0]!;
  const call = (
    method: 'GET' | 'POST' | 'PUT' | 'PATCH',
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: { cookie, ...headers },
      ...(payload ? { payload } : {}),
    });
  return { app, call };
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});

// As Leo would on Tim & agent: Akira runs on Hermes, with a token budget.
async function configureAkira(
  call: Awaited<ReturnType<typeof session>>['call'],
  budget = 8000,
) {
  const akira = (await call('GET', '/agents/akira')).json().agent;
  const res = await call('PUT', '/agents/akira', {
    version: akira.version,
    config: {
      ...akira.config,
      provider: 'hermes',
      model: 'akira',
      limits: { ...akira.config.limits, tokenBudget: budget },
    },
  });
  expect(res.statusCode).toBe(200);
}
const ask = (
  call: Awaited<ReturnType<typeof session>>['call'],
  instruction = 'Siapa kamu?',
) => call('POST', '/akira/ask', { instruction });

describe('Hermes connection', () => {
  test('says plainly when Hermes is not configured', async () => {
    const { call } = await session(undefined, {});
    const status = (await call('GET', '/hermes/status')).json();
    expect(status.configured).toBe(false);
    expect(status.connected).toBe(false);
    expect((await ask(call)).statusCode).toBe(409);
  });

  test('only accepts a Hermes URL on this machine', () => {
    expect(() =>
      parseConfig({
        OWNER_PASSWORD: password,
        HERMES_API_URL: 'https://example.com',
        HERMES_API_KEY: hermesKey,
      }),
    ).toThrow();
    expect(() =>
      parseConfig({
        OWNER_PASSWORD: password,
        HERMES_API_URL: 'http://localhost:8643',
        HERMES_API_KEY: hermesKey,
      }),
    ).not.toThrow();
  });

  test('reports a verified connection, the model name and the enabled toolsets', async () => {
    const { call } = await session(fakeHermes() as unknown as typeof fetch);
    const status = (await call('GET', '/hermes/status')).json();
    expect(status).toMatchObject({
      configured: true,
      connected: true,
      safe: true,
      model: 'akira',
      toolsEnabled: [],
    });
    expect(JSON.stringify(status)).not.toContain(hermesKey);
  });

  test('a refused key is reported as not connected', async () => {
    const { call } = await session(fakeHermes() as unknown as typeof fetch, {
      HERMES_API_URL: 'http://127.0.0.1:8643',
      HERMES_API_KEY: 'another-wrong-key-123456',
    });
    const status = (await call('GET', '/hermes/status')).json();
    expect(status.connected).toBe(false);
    expect(status.reason).toMatch(/401/);
  });

  test('an unreachable Hermes is not connected', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const { call } = await session(down as unknown as typeof fetch);
    expect((await call('GET', '/hermes/status')).json().connected).toBe(false);
  });
});

describe('Akira answers through Hermes', () => {
  test('refuses until Akira is set to Hermes and has a budget', async () => {
    const fetchImpl = fakeHermes();
    const { call } = await session(fetchImpl as unknown as typeof fetch);
    expect((await ask(call)).json().error).toMatch(/provider Hermes/);
    await configureAkira(call, 0);
    expect((await ask(call)).json().error).toMatch(/Anggaran/);
    expect(
      fetchImpl.mock.calls.some(([u]) =>
        String(u).endsWith('/chat/completions'),
      ),
    ).toBe(false);
  });

  test('stores a real answer with model, tokens and unknown cost; runtime becomes ready', async () => {
    const fetchImpl = fakeHermes();
    const { call } = await session(fetchImpl as unknown as typeof fetch);
    await configureAkira(call);
    const res = await ask(call, 'Rencanakan konten minggu ini');
    expect(res.statusCode).toBe(201);
    const run = res.json().run;
    expect(run).toMatchObject({
      agent: 'akira',
      status: 'completed',
      answer: 'Saya Akira, melapor kepada Leo.',
      model: 'akira',
      costUsd: null,
    });
    expect(run.tokens).toEqual({ prompt: 100, completion: 20, total: 120 });
    // The registry prompt goes to Hermes as the system message, and the key only as a header.
    const chat = fetchImpl.mock.calls.find(([u]) =>
      String(u).endsWith('/chat/completions'),
    )!;
    const sent = JSON.parse(String(chat[1]!.body));
    expect(sent.messages[0].content).toContain(
      'You are Akira, the General Manager of 204 Project Group',
    );
    expect(sent.messages[1].content).toBe('Rencanakan konten minggu ini');
    expect(sent.max_tokens).toBeLessThanOrEqual(8000);
    expect(String(chat[1]!.body)).not.toContain(hermesKey);
    expect(res.body).not.toContain(hermesKey);
    expect((await call('GET', '/akira/runs')).json().runs[0].id).toBe(run.id);
    const agents = (await call('GET', '/agents')).json().agents;
    expect(
      agents.find((a: { id: string }) => a.id === 'akira').runtime.status,
    ).toBe('ready');
    expect(
      agents.find((a: { id: string }) => a.id === 'kuro').runtime.status,
    ).toBe('not_connected');
    const actions = (await call('GET', '/audit'))
      .json()
      .map((e: { action: string }) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(['akira.ask', 'akira.answer']),
    );
  });

  test('refuses while Hermes exposes a tool that can act', async () => {
    const fetchImpl = fakeHermes({
      toolsets: [{ name: 'terminal', enabled: true }],
    });
    const { call } = await session(fetchImpl as unknown as typeof fetch);
    await configureAkira(call);
    const res = await ask(call);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/terminal/);
    expect(
      fetchImpl.mock.calls.some(([u]) =>
        String(u).endsWith('/chat/completions'),
      ),
    ).toBe(false);
    expect((await call('GET', '/akira/runs')).json().runs[0].status).toBe(
      'failed',
    );
    expect(
      (await call('GET', '/agents'))
        .json()
        .agents.find((a: { id: string }) => a.id === 'akira').runtime.status,
    ).toBe('not_connected');
  });

  test('retries a 503 once, then records a failure without inventing an answer', async () => {
    const chat = vi.fn(() => json({ error: 'busy' }, 503));
    const fetchImpl = fakeHermes({ chat });
    const { call } = await session(fetchImpl as unknown as typeof fetch);
    await configureAkira(call);
    const res = await ask(call);
    expect(res.statusCode).toBe(502);
    expect(chat).toHaveBeenCalledTimes(2);
    const run = (await call('GET', '/akira/runs')).json().runs[0];
    expect(run).toMatchObject({ status: 'failed', answer: null, tokens: null });
    expect(run.error).toMatch(/503/);
  });

  test('a busy Hermes (429) is not retried', async () => {
    const chat = vi.fn(() => json({ error: 'busy' }, 429));
    const { call } = await session(
      fakeHermes({ chat }) as unknown as typeof fetch,
    );
    await configureAkira(call);
    expect((await ask(call)).statusCode).toBe(429);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  test('takes one instruction at a time', async () => {
    let release: (r: Response) => void = () => {};
    const chat = () => new Promise<Response>((resolve) => (release = resolve));
    const { call } = await session(
      fakeHermes({ chat }) as unknown as typeof fetch,
    );
    await configureAkira(call);
    const first = ask(call, 'Pertama');
    await vi.waitFor(async () =>
      expect((await call('GET', '/hermes/status')).json().running).toBe(true),
    );
    const second = await ask(call, 'Kedua');
    expect(second.statusCode).toBe(429);
    release(
      json({ model: 'akira', choices: [{ message: { content: 'ok' } }] }),
    );
    expect((await first).statusCode).toBe(201);
  });

  test('validates the instruction and needs Leo logged in', async () => {
    const { app, call } = await session(
      fakeHermes() as unknown as typeof fetch,
    );
    expect(
      (await call('POST', '/akira/ask', { instruction: 'x' })).statusCode,
    ).toBe(400);
    expect(
      (await call('POST', '/akira/ask', { instruction: 'a'.repeat(4001) }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/akira/ask',
          headers,
          payload: { instruction: 'halo' },
        })
      ).statusCode,
    ).toBe(401);
  });

  test('a disabled Akira refuses and shows as disabled', async () => {
    const { call } = await session(fakeHermes() as unknown as typeof fetch);
    await configureAkira(call);
    await call('PATCH', '/agents/akira/enabled', { enabled: false });
    expect((await ask(call)).json().error).toMatch(/dinonaktifkan/);
    expect(
      (await call('GET', '/agents/akira')).json().agent.runtime.status,
    ).toBe('disabled');
  });
});
