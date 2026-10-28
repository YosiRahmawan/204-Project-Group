import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createApp } from './app.js';
import { parseConfig } from './config.js';
import {
  VaultError,
  checkContent,
  cleanPath,
  createVault,
  refusal,
} from './vault.js';

const password = 'correct-horse-battery';
const headers = { 'x-requested-with': '204' };
const dirs: string[] = [];
const apps: ReturnType<typeof createApp>[] = [];

const makeVault = () => {
  const vault = mkdtempSync(join(tmpdir(), 'vault-'));
  dirs.push(vault);
  mkdirSync(join(vault, '.obsidian'));
  writeFileSync(join(vault, 'Selamat datang.md'), 'catatan lama');
  return vault;
};

async function session(vault?: string) {
  const folder = mkdtempSync(join(tmpdir(), 'mem-'));
  dirs.push(folder);
  const app = createApp(
    parseConfig({
      OWNER_PASSWORD: password,
      DATABASE_PATH: join(folder, 'o.db'),
      UPLOAD_DIR: join(folder, 'up'),
      ...(vault ? { OBSIDIAN_VAULT_PATH: vault } : {}),
    }),
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

const put = (
  call: Awaited<ReturnType<typeof session>>['call'],
  as: string,
  path: string,
  content: string,
  expectedHash: string | null = null,
) => call('PUT', '/memory/note', { as, path, content, expectedHash });

// Lets an agent read shared memory and propose changes, as Leo would in its Memory tab.
async function grant(
  call: Awaited<ReturnType<typeof session>>['call'],
  id: string,
  memory: object,
) {
  const agent = (await call('GET', `/agents/${id}`)).json().agent;
  const res = await call('PUT', `/agents/${id}`, {
    version: agent.version,
    config: { ...agent.config, memory: { ...agent.config.memory, ...memory } },
  });
  expect(res.statusCode).toBe(200);
}

describe('vault rules', () => {
  test('only plain note paths inside the known areas', () => {
    for (const bad of [
      '../x.md',
      'Agents/../../x.md',
      'Other/x.md',
      'Agents/x.txt',
      '/etc/x.md',
      'Shared/.hidden.md',
      'Shared/a/../b.md',
      'x.md',
    ])
      expect(() => cleanPath(bad), bad).toThrow(VaultError);
    expect(cleanPath('Agents/aeri/Lessons/2026-01-01-error-x.md')).toBe(
      'Agents/aeri/Lessons/2026-01-01-error-x.md',
    );
  });
  test('refuses notes that carry secrets or are too big', () => {
    for (const secret of [
      'sk-ant-abcdefghijklmnop1234',
      'password: hunter2hunter2',
      'API_KEY=abcdef123456',
      '-----BEGIN RSA PRIVATE KEY-----',
    ])
      expect(() => checkContent(`catatan ${secret}`), secret).toThrow(
        VaultError,
      );
    expect(() => checkContent('a'.repeat(70_000))).toThrow(VaultError);
    expect(() => checkContent('Belajar: hook pertama menang.')).not.toThrow();
  });
  test('an agent writes only to its own folder; shared areas need a proposal right', () => {
    const memory = {
      personal: true,
      sharedRead: false,
      sharedWriteProposal: false,
      namespace: 'aeri',
      retention: '90d' as const,
    };
    expect(refusal('aeri', 'Agents/aeri/a.md', 'write', memory)).toBeNull();
    expect(refusal('aeri', 'Agents/kuro/a.md', 'write', memory)).not.toBeNull();
    expect(refusal('aeri', 'Shared/a.md', 'write', memory)).not.toBeNull();
    expect(refusal('aeri', 'Shared/a.md', 'read', memory)).not.toBeNull();
    expect(
      refusal('aeri', 'Shared/a.md', 'read', { ...memory, sharedRead: true }),
    ).toBeNull();
    expect(
      refusal('aeri', 'Agents/kuro/a.md', 'read', {
        ...memory,
        sharedRead: true,
      }),
    ).not.toBeNull();
    expect(
      refusal('aeri', 'Logs/memory.md', 'read', {
        ...memory,
        sharedRead: true,
      }),
    ).not.toBeNull();
  });
  test('refuses a folder that is not an existing Obsidian vault', () => {
    const plain = mkdtempSync(join(tmpdir(), 'plain-'));
    dirs.push(plain);
    expect(() => createVault(plain)).toThrow(/Obsidian/);
    expect(existsSync(join(plain, 'Agents'))).toBe(false);
  });
});

describe('memory API', () => {
  test('says clearly when no vault is configured', async () => {
    const { call } = await session();
    expect((await call('GET', '/memory/status')).json().configured).toBe(false);
    expect((await call('POST', '/memory/init')).statusCode).toBe(409);
  });

  test('init creates the structure once and never touches existing notes', async () => {
    const vault = makeVault();
    const { call } = await session(vault);
    const first = (await call('POST', '/memory/init')).json()
      .created as string[];
    for (const area of [
      'Agents',
      'Shared',
      'Strategy',
      'Campaigns',
      'Decisions',
      'Logs',
    ])
      expect(existsSync(join(vault, area, 'README.md'))).toBe(true);
    for (const id of ['akira', 'amy', 'aeri', 'kuro', 'mail', 'zegion'])
      expect(existsSync(join(vault, 'Agents', id, 'README.md'))).toBe(true);
    expect(first.length).toBeGreaterThan(10);
    expect((await call('POST', '/memory/init')).json().created).toEqual([]);
    expect(readFileSync(join(vault, 'Selamat datang.md'), 'utf8')).toBe(
      'catatan lama',
    );
  });

  test('an agent keeps private memory: own folder yes, other agents and shared no', async () => {
    const { call } = await session(makeVault());
    await call('POST', '/memory/init');
    const mine = await put(
      call,
      'aeri',
      'Agents/aeri/ide.md',
      'Hook pendek lebih baik.',
    );
    expect(mine.statusCode).toBe(201);
    expect(
      (await put(call, 'aeri', 'Agents/kuro/ide.md', 'x')).statusCode,
    ).toBe(403);
    expect((await put(call, 'aeri', 'Shared/ide.md', 'x')).statusCode).toBe(
      403,
    );
    expect(
      (await call('GET', '/memory/note?as=kuro&path=Agents/aeri/ide.md'))
        .statusCode,
    ).toBe(403);
    expect(
      (await call('GET', '/memory/note?as=aeri&path=Agents/aeri/ide.md')).json()
        .content,
    ).toBe('Hook pendek lebih baik.');
  });

  test('every write is atomic and conflict-safe, with a backup of the old text', async () => {
    const vault = makeVault();
    const { call } = await session(vault);
    const first = (await put(call, 'aeri', 'Agents/aeri/a.md', 'satu')).json();
    // Writing a new note over an existing one, or from a stale read, is a conflict.
    expect(
      (await put(call, 'aeri', 'Agents/aeri/a.md', 'dua')).statusCode,
    ).toBe(409);
    const second = await put(
      call,
      'aeri',
      'Agents/aeri/a.md',
      'dua',
      first.hash,
    );
    expect(second.statusCode).toBe(200);
    expect(
      (await put(call, 'aeri', 'Agents/aeri/a.md', 'tiga', first.hash))
        .statusCode,
    ).toBe(409);
    const backups = readdirSync(join(vault, '.204-backups'));
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(vault, '.204-backups', backups[0]!), 'utf8')).toBe(
      'satu',
    );
    expect(
      readdirSync(join(vault, 'Agents', 'aeri')).some((f) =>
        f.startsWith('.tmp-'),
      ),
    ).toBe(false);
  });

  test('rejects secrets, traversal and unknown agents', async () => {
    const { call } = await session(makeVault());
    expect(
      (await put(call, 'leo', 'Shared/k.md', 'token = abcdef123456789'))
        .statusCode,
    ).toBe(400);
    expect((await put(call, 'leo', 'Shared/../../x.md', 'x')).statusCode).toBe(
      400,
    );
    expect(
      (await put(call, 'ghost', 'Agents/ghost/a.md', 'x')).statusCode,
    ).toBe(403);
  });

  test('shared memory changes go through a proposal that Leo approves', async () => {
    const vault = makeVault();
    const { call } = await session(vault);
    const propose = (as: string) =>
      call('POST', '/memory/proposals', {
        as,
        path: 'Shared/aturan.md',
        content: 'Selalu cek klaim.',
        reason: 'Pelajaran dari campaign Mei',
      });
    expect((await propose('amy')).statusCode).toBe(403);
    await grant(call, 'amy', { sharedWriteProposal: true, sharedRead: true });
    const made = await propose('amy');
    expect(made.statusCode).toBe(201);
    expect(existsSync(join(vault, 'Shared', 'aturan.md'))).toBe(false);
    const id = made.json().proposal.id;
    const approved = await call('POST', `/memory/proposals/${id}/decision`, {
      decision: 'approve',
    });
    expect(approved.json().proposal.status).toBe('approved');
    expect(readFileSync(join(vault, 'Shared', 'aturan.md'), 'utf8')).toBe(
      'Selalu cek klaim.',
    );
    expect(
      (
        await call('POST', `/memory/proposals/${id}/decision`, {
          decision: 'approve',
        })
      ).statusCode,
    ).toBe(409);
    // Once allowed to read shared memory, the same agent sees the approved note.
    expect(
      (await call('GET', '/memory/note?as=amy&path=Shared/aturan.md')).json()
        .content,
    ).toBe('Selalu cek klaim.');
  });

  test('a rejected proposal writes nothing, and a stale one is a conflict', async () => {
    const vault = makeVault();
    const { call } = await session(vault);
    await grant(call, 'amy', { sharedWriteProposal: true });
    const make = async (content: string) =>
      (
        await call('POST', '/memory/proposals', {
          as: 'amy',
          path: 'Decisions/d.md',
          content,
          reason: 'alasan jelas',
        })
      ).json().proposal.id as string;
    const rejected = await make('A');
    await call('POST', `/memory/proposals/${rejected}/decision`, {
      decision: 'reject',
    });
    expect(existsSync(join(vault, 'Decisions', 'd.md'))).toBe(false);
    const late = await make('B');
    await put(call, 'leo', 'Decisions/d.md', 'Leo menulis lebih dulu');
    expect(
      (
        await call('POST', `/memory/proposals/${late}/decision`, {
          decision: 'approve',
        })
      ).statusCode,
    ).toBe(409);
    expect(readFileSync(join(vault, 'Decisions', 'd.md'), 'utf8')).toBe(
      'Leo menulis lebih dulu',
    );
  });

  test('lessons are saved per agent as unevaluated notes, and logged', async () => {
    const vault = makeVault();
    const { call } = await session(vault);
    const lesson = {
      as: 'aeri',
      kind: 'error',
      title: 'Hook terlalu panjang',
      body: 'Penonton pergi di detik 3.',
    };
    const a = await call('POST', '/memory/lessons', lesson);
    const b = await call('POST', '/memory/lessons', lesson);
    expect(a.statusCode).toBe(201);
    expect(b.json().path).not.toBe(a.json().path);
    const note = readFileSync(join(vault, ...a.json().path.split('/')), 'utf8');
    expect(note).toContain('status: belum dievaluasi');
    expect(note).toContain('agent: aeri');
    const log = readdirSync(join(vault, 'Logs')).find((f) =>
      f.startsWith('memory-'),
    )!;
    expect(readFileSync(join(vault, 'Logs', log), 'utf8')).toContain(
      'memory.lesson aeri',
    );
    expect(
      (await call('POST', '/memory/lessons', { ...lesson, as: 'leo' }))
        .statusCode,
    ).toBe(400);
    const actions = (await call('GET', '/audit'))
      .json()
      .map((e: { action: string }) => e.action);
    expect(actions).toContain('memory.lesson');
  });

  test('a disabled agent cannot use memory, and the status reports no automatic learning', async () => {
    const { call } = await session(makeVault());
    await call('PATCH', '/agents/kuro/enabled', { enabled: false });
    expect((await put(call, 'kuro', 'Agents/kuro/a.md', 'x')).statusCode).toBe(
      403,
    );
    expect(
      (
        await call('POST', '/memory/lessons', {
          as: 'kuro',
          kind: 'error',
          title: 'Judul',
          body: 'Isi catatan',
        })
      ).statusCode,
    ).toBe(403);
    const status = (await call('GET', '/memory/status')).json();
    expect(status.configured).toBe(true);
    expect(status.learning.automatic).toBe(false);
  });
});
