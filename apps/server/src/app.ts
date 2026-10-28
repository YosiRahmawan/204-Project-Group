import Fastify, { type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  advance,
  createTask,
  decide,
  demoTasks,
  maxBytes,
} from '@204/contracts';
import type { Config } from './config.js';
import { createAuth, sessionToken } from './auth.js';
import { cleanName, sniffType } from './files.js';
import { createStore, openDatabase } from './store.js';
import { createAgents, loadRegistry } from './agents.js';
import { registerAgentRoutes } from './agent-routes.js';
import { createCampaigns } from './campaigns.js';
import { registerCampaignRoutes } from './campaign-routes.js';

const publicPaths = new Set(['/health', '/auth/login']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const day = 24 * 3_600_000;

const taskBody = z.object({
  instruction: z.string().max(4000).default(''),
  fileIds: z.array(z.string().regex(uuid)).max(5).default([]),
});
const advanceBody = z.object({
  // The stage the screen was showing; a second click on the same button is then a conflict.
  from: z.string().max(40).optional(),
});
const decisionBody = z.object({
  decision: z.enum(['approve', 'revise', 'reject']),
  version: z.number().int().min(0),
  reason: z.string().max(1000).default(''),
});
const idempotencyKey = z.string().min(8).max(100);

// `fetchImpl` lets tests stand in for the AI provider.
export function createApp(
  config: Config,
  logging = false,
  fetchImpl?: typeof fetch,
) {
  const app = Fastify({
    logger: logging
      ? {
          level: config.LOG_LEVEL,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        }
      : false,
    bodyLimit: 64 * 1024,
    trustProxy: config.TRUST_PROXY,
  });
  const https = config.WEB_ORIGIN.startsWith('https:');

  const db = openDatabase(config.DATABASE_PATH);
  const store = createStore(db);
  mkdirSync(config.UPLOAD_DIR, { recursive: true });
  const removeFiles = (ids: string[]) =>
    ids.forEach((id) => rmSync(join(config.UPLOAD_DIR, id), { force: true }));
  // Uploads that were never attached to a task are dropped after a day.
  removeFiles(store.purgeOrphans(Date.now() - day));
  store.replies.purge(Date.now() - day);
  app.addHook('onClose', async () => db.close());

  const auth = createAuth(
    config.OWNER_PASSWORD,
    config.SESSION_HOURS,
    https,
    store.sessions,
  );

  // Live updates: browsers keep a stream open and re-read the list when told it changed.
  const streams = new Set<ServerResponse>();
  const announce = () =>
    streams.forEach((stream) => stream.write('event: changed\ndata: 1\n\n'));
  const heartbeat = setInterval(
    () => streams.forEach((stream) => stream.write(': ping\n\n')),
    25_000,
  );
  heartbeat.unref();
  app.addHook('preClose', async () => {
    clearInterval(heartbeat);
    streams.forEach((stream) => stream.end());
  });

  // Security headers on every answer (the event stream and files set their own).
  const securityHeaders: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    ...(https
      ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' }
      : {}),
  };
  app.addHook('onSend', async (_request, reply) => {
    for (const [name, value] of Object.entries(securityHeaders))
      if (!reply.hasHeader(name)) reply.header(name, value);
  });

  app.register(cors, {
    origin: [config.WEB_ORIGIN],
    methods: ['GET'],
    credentials: false,
  });
  // Uploads arrive as raw bytes, up to the file size limit.
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: maxBytes },
    (_request, body, done) => done(null, body),
  );

  // Every route except /health and the login needs Leo's session. A custom header on
  // anything that changes data keeps other websites from sending requests on his behalf.
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0]!;
    const reads = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (!reads && request.headers['x-requested-with'] !== '204')
      return reply.code(403).send({ error: 'Permintaan ditolak.' });
    if (publicPaths.has(path)) return;
    if (!auth.valid(sessionToken(request.headers.cookie)))
      return reply.code(401).send({ error: 'Belum masuk.' });
  });

  app.get('/health', () => ({ status: 'ok', service: '204-project-group' }));

  app.post('/auth/login', async (request, reply) => {
    const body = z
      .object({ password: z.string().max(200) })
      .safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    const result = auth.login(body.data.password, request.ip);
    store.audit(
      result === 'ok' ? 'Leo' : 'anonim',
      `login.${result}`,
      request.ip,
    );
    if (result === 'limited')
      return reply
        .code(429)
        .send({ error: 'Terlalu banyak percobaan. Tunggu semenit.' });
    if (result === 'bad')
      return reply.code(401).send({ error: 'Kata sandi salah.' });
    reply.header('set-cookie', auth.cookie(auth.open()));
    return { ok: true };
  });
  app.post('/auth/logout', async (request, reply) => {
    auth.close(sessionToken(request.headers.cookie));
    store.audit('Leo', 'logout');
    reply.header('set-cookie', auth.clearCookie());
    return { ok: true };
  });
  app.get('/auth/me', () => ({ owner: 'Leo' }));

  app.get('/events', (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      ...securityHeaders,
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    reply.raw.write('retry: 3000\n\n');
    streams.add(reply.raw);
    request.raw.on('close', () => streams.delete(reply.raw));
  });

  app.get('/audit', async (request) => {
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(500).default(100) })
      .parse(request.query);
    return store.auditList(limit);
  });

  const agents = createAgents(db);
  agents.seed();
  const registry = loadRegistry(
    config.MODEL_REGISTRY_PATH ??
      fileURLToPath(new URL('../models.registry.json', import.meta.url)),
  );
  const audit = (action: string, detail: string) =>
    store.audit('Leo', action, detail);
  registerAgentRoutes(app, {
    agents,
    registry,
    env: process.env,
    audit,
    announce,
  });
  registerCampaignRoutes(app, {
    campaigns: createCampaigns(db),
    agents,
    registry,
    env: process.env,
    ...(fetchImpl ? { fetchImpl } : {}),
    audit,
    announce,
  });

  app.get('/tasks', () => store.list());

  app.post('/tasks', async (request, reply) => {
    const body = taskBody.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    // A retry or double submit with the same key gets the first answer and creates nothing.
    const key = idempotencyKey.safeParse(request.headers['idempotency-key']);
    const earlier = key.success ? store.replies.get(key.data) : null;
    if (earlier)
      return reply
        .code(earlier.status)
        .header('content-type', 'application/json')
        .send(earlier.body);
    const result = store.insert(
      (number, files) =>
        createTask(body.data.instruction, number, Date.now(), files),
      body.data.fileIds,
    );
    if (!result.ok) return reply.code(400).send({ error: result.error });
    if (key.success)
      store.replies.put(key.data, 201, JSON.stringify(result.task));
    store.audit('Leo', 'task.create', result.task.id);
    announce();
    return reply.code(201).send(result.task);
  });

  // Sample tasks in every stage, to try the dashboard.
  app.post('/tasks/demo', async (_request, reply) => {
    const added = store.insertMany((first) => demoTasks(Date.now(), first));
    store.audit('Leo', 'tasks.demo', String(added));
    announce();
    return reply.code(201).send({ added });
  });
  app.delete('/tasks', async (_request, reply) => {
    store.clear();
    removeFiles(store.purgeOrphans(Date.now() + 1));
    store.audit('Leo', 'tasks.clear');
    announce();
    return reply.code(204).send();
  });

  const step = async (
    request: { params: unknown },
    reply: FastifyReply,
    action: string,
    detail: (task: { id: string; status: string; version: number }) => string,
    change: Parameters<typeof store.update>[1],
  ) => {
    const number = Number((request.params as { number: string }).number);
    if (!Number.isInteger(number) || number < 1)
      return reply.code(404).send({ error: 'Task tidak ditemukan.' });
    const result = store.update(number, change);
    if (!result)
      return reply.code(404).send({ error: 'Task tidak ditemukan.' });
    // A step that the rules refuse (wrong stage, stale version) is a conflict, not a crash.
    if (!result.ok) return reply.code(409).send({ error: result.error });
    store.audit('Leo', action, `${result.task.id} ${detail(result.task)}`);
    announce();
    return result.task;
  };
  app.post('/tasks/:number/advance', (request, reply) => {
    const body = advanceBody.safeParse(request.body ?? {});
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    const { from } = body.data;
    return step(
      request,
      reply,
      'task.advance',
      (task) => task.status,
      (task) =>
        from && task.status !== from
          ? { ok: false, error: 'Task sudah pindah tahap. Muat ulang halaman.' }
          : advance(task, Date.now()),
    );
  });
  app.post('/tasks/:number/decision', (request, reply) => {
    const body = decisionBody.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    const { decision, version, reason } = body.data;
    return step(
      request,
      reply,
      `task.${decision}`,
      (task) => `v${task.version}`,
      (task) => decide(task, decision, version, reason, Date.now()),
    );
  });

  app.post('/files', async (request, reply) => {
    const bytes = request.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0)
      return reply.code(400).send({ error: 'File kosong.' });
    const header = String(request.headers['x-file-name'] ?? 'file');
    let raw = header;
    try {
      raw = decodeURIComponent(header);
    } catch {
      // A badly encoded name is kept as sent and cleaned below.
    }
    const name = cleanName(raw);
    const type = sniffType(bytes, name);
    if (!type) {
      store.audit('Leo', 'file.refused', name);
      return reply.code(415).send({ error: 'Jenis file tidak diizinkan.' });
    }
    const file = { id: randomUUID(), name, size: bytes.length, type };
    writeFileSync(join(config.UPLOAD_DIR, file.id), bytes);
    store.addFile(file);
    store.audit('Leo', 'file.upload', `${name} ${type}`);
    return reply.code(201).send(file);
  });
  app.get('/files/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = uuid.test(id) ? store.file(id) : null;
    if (!file) return reply.code(404).send({ error: 'File tidak ditemukan.' });
    // Only photos are shown in the page; everything else downloads, and nothing is ever run.
    const disposition = file.type.startsWith('image/')
      ? 'inline'
      : `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`;
    return reply
      .header('content-type', file.type)
      .header('content-disposition', disposition)
      .header('content-security-policy', "default-src 'none'; sandbox")
      .send(createReadStream(join(config.UPLOAD_DIR, id)));
  });

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
