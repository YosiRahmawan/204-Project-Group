import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { emptyCampaign, type CampaignInput } from '@204/contracts';
import { createApp } from './app.js';
import { parseConfig } from './config.js';

const password = 'correct-horse-battery';
const headers = { 'x-requested-with': '204' };
const dirs: string[] = [];
const apps: ReturnType<typeof createApp>[] = [];

async function session(fetchImpl?: typeof fetch) {
  const folder = mkdtempSync(join(tmpdir(), 'camp-'));
  dirs.push(folder);
  const app = createApp(
    parseConfig({
      OWNER_PASSWORD: password,
      DATABASE_PATH: join(folder, 'o.db'),
      UPLOAD_DIR: join(folder, 'up'),
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
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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
  delete process.env.ANTHROPIC_API_KEY;
  await Promise.all(apps.splice(0).map((a) => a.close()));
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});

const sample = (): CampaignInput => ({
  ...emptyCampaign(),
  name: 'Promo Mei',
  product: {
    ...emptyCampaign().product,
    name: 'Botol minum',
    benefits: 'Tahan panas',
  },
  affiliateLink: 'https://shope.ee/abc',
});
const reply = (text: string) =>
  vi.fn(
    async () =>
      new Response(JSON.stringify({ content: [{ type: 'text', text }] }), {
        status: 200,
      }),
  );

// Gives Aeri a model and a budget, as Leo would on the Tim & agent page.
async function configureAeri(
  call: Awaited<ReturnType<typeof session>>['call'],
) {
  const aeri = (await call('GET', '/agents/aeri')).json().agent;
  const res = await call('PUT', '/agents/aeri', {
    version: aeri.version,
    config: {
      ...aeri.config,
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      limits: { ...aeri.config.limits, tokenBudget: 4000 },
    },
  });
  expect(res.statusCode).toBe(200);
}

describe('campaigns', () => {
  test('need Leo to be logged in', async () => {
    const { app } = await session();
    expect(
      (await app.inject({ method: 'GET', url: '/campaigns' })).statusCode,
    ).toBe(401);
  });

  test('create, list, edit, approve and delete, with versions and audit', async () => {
    const { call } = await session();
    const created = await call('POST', '/campaigns', { config: sample() });
    expect(created.statusCode).toBe(201);
    const c = created.json().campaign;
    expect((await call('GET', '/campaigns')).json().campaigns).toHaveLength(1);

    const edited = await call('PUT', `/campaigns/${c.id}`, {
      version: c.version,
      config: {
        ...c.config,
        content: { ...c.config.content, caption: 'Halo' },
      },
    });
    expect(edited.json().campaign.config.content.caption).toBe('Halo');
    expect(
      (
        await call('PUT', `/campaigns/${c.id}`, {
          version: c.version,
          config: c.config,
        })
      ).statusCode,
    ).toBe(409);

    const v = edited.json().campaign.version;
    const approved = (
      await call('POST', `/campaigns/${c.id}/approve`, { version: v })
    ).json().campaign;
    expect(approved.status).toBe('approved');
    // Editing after approval puts it back to draft.
    const again = await call('PUT', `/campaigns/${c.id}`, {
      version: approved.version,
      config: approved.config,
    });
    expect(again.json().campaign.status).toBe('draft');

    expect((await call('DELETE', `/campaigns/${c.id}`)).statusCode).toBe(204);
    expect((await call('GET', `/campaigns/${c.id}`)).statusCode).toBe(404);
    const actions = (await call('GET', '/audit'))
      .json()
      .map((e: { action: string }) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'campaign.create',
        'campaign.update',
        'campaign.approve',
        'campaign.delete',
      ]),
    );
  });

  test('validate input, including non-web links', async () => {
    const { call } = await session();
    const bad = async (patch: Partial<CampaignInput>) =>
      expect(
        (
          await call('POST', '/campaigns', {
            config: { ...sample(), ...patch },
          })
        ).statusCode,
      ).toBe(400);
    await bad({ name: 'x' });
    await bad({ affiliateLink: 'javascript:alert(1)' });
    await bad({ product: { ...sample().product, name: '' } });
  });

  test('keeps data across a restart', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'camp-'));
    dirs.push(folder);
    const make = () =>
      createApp(
        parseConfig({
          OWNER_PASSWORD: password,
          DATABASE_PATH: join(folder, 'o.db'),
          UPLOAD_DIR: join(folder, 'up'),
        }),
      );
    const login = async (app: ReturnType<typeof createApp>) =>
      String(
        (
          await app.inject({
            method: 'POST',
            url: '/auth/login',
            headers,
            payload: { password },
          })
        ).headers['set-cookie'],
      ).split(';')[0]!;
    const first = make();
    const cookie = await login(first);
    await first.inject({
      method: 'POST',
      url: '/campaigns',
      headers: { cookie, ...headers },
      payload: { config: sample() },
    });
    await first.close();
    const second = make();
    apps.push(second);
    const list = await second.inject({
      method: 'GET',
      url: '/campaigns',
      headers: { cookie: await login(second) },
    });
    expect(list.json().campaigns).toHaveLength(1);
  });
});

describe('AI drafts', () => {
  test('are refused with a clear reason until the agent and key are set up', async () => {
    const fetchImpl = reply('{}');
    const { call } = await session(fetchImpl as unknown as typeof fetch);
    const c = (await call('POST', '/campaigns', { config: sample() })).json()
      .campaign;
    const ask = () =>
      call('POST', `/campaigns/${c.id}/generate`, {
        version: c.version,
        kind: 'script',
      });
    expect((await ask()).json().error).toMatch(/Anthropic/);
    await configureAeri(call);
    expect((await ask()).json().error).toMatch(/ANTHROPIC_API_KEY/);
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    const aeri = (await call('GET', '/agents/aeri')).json().agent;
    await call('PUT', '/agents/aeri', {
      version: aeri.version,
      config: {
        ...aeri.config,
        limits: { ...aeri.config.limits, tokenBudget: 0 },
      },
    });
    expect((await ask()).json().error).toMatch(/Anggaran/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('become an editable draft from the agent that owns the task, and are never approved', async () => {
    const fetchImpl = reply(
      'Ini hasilnya: {"hooks":["Haus?"],"script":"Scene satu","cta":"Klik keranjang"}',
    );
    const { call } = await session(fetchImpl as unknown as typeof fetch);
    await configureAeri(call);
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    const c = (await call('POST', '/campaigns', { config: sample() })).json()
      .campaign;
    const res = await call('POST', `/campaigns/${c.id}/generate`, {
      version: c.version,
      kind: 'script',
    });
    expect(res.statusCode).toBe(200);
    const out = res.json().campaign;
    expect(out.config.content.script).toBe('Scene satu');
    expect(out.aiDraft).toBe(true);
    expect(out.status).toBe('draft');
    // The key goes to the provider header only, never into the body or the answer.
    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(
      'sk-test-key',
    );
    expect(String(init.body)).not.toContain('sk-test-key');
    expect(res.body).not.toContain('sk-test-key');
    // Saving by hand clears the AI flag.
    const saved = await call('PUT', `/campaigns/${c.id}`, {
      version: out.version,
      config: out.config,
    });
    expect(saved.json().campaign.aiDraft).toBe(false);
  });

  test('a storyboard needs Kuro, not Aeri', async () => {
    const { call } = await session(reply('{}') as unknown as typeof fetch);
    await configureAeri(call);
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    const c = (await call('POST', '/campaigns', { config: sample() })).json()
      .campaign;
    const res = await call('POST', `/campaigns/${c.id}/generate`, {
      version: c.version,
      kind: 'storyboard',
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/Kuro/);
  });

  test('reject malformed AI answers without touching the campaign', async () => {
    const { call } = await session(
      reply('maaf, tidak bisa') as unknown as typeof fetch,
    );
    await configureAeri(call);
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    const c = (await call('POST', '/campaigns', { config: sample() })).json()
      .campaign;
    const res = await call('POST', `/campaigns/${c.id}/generate`, {
      version: c.version,
      kind: 'caption',
    });
    expect(res.statusCode).toBe(502);
    expect(
      (await call('GET', `/campaigns/${c.id}`)).json().campaign.version,
    ).toBe(c.version);
  });
});
