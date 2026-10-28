import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Agents } from './agents.js';
import { HermesError, type Hermes } from './hermes.js';

export const akiraSchema = `
CREATE TABLE IF NOT EXISTS akira_runs (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  instruction TEXT NOT NULL,
  status TEXT NOT NULL,
  answer TEXT,
  error TEXT,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd REAL,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
`;

type Row = Record<string, string | number | null>;
const toRun = (r: Row) => ({
  id: String(r.id),
  agent: String(r.agent),
  instruction: String(r.instruction),
  status: String(r.status) as 'running' | 'completed' | 'failed',
  answer: r.answer === null ? null : String(r.answer),
  error: r.error === null ? null : String(r.error),
  model: r.model === null ? null : String(r.model),
  tokens:
    r.total_tokens === null
      ? null
      : {
          prompt: Number(r.prompt_tokens),
          completion: Number(r.completion_tokens),
          total: Number(r.total_tokens),
        },
  // Hermes reports no price, so cost stays null rather than a guess.
  costUsd: r.cost_usd === null ? null : Number(r.cost_usd),
  durationMs: r.duration_ms === null ? null : Number(r.duration_ms),
  createdAt: Number(r.created_at),
  finishedAt: r.finished_at === null ? null : Number(r.finished_at),
});

function createRuns(db: DatabaseSync) {
  // A run left "running" by a crash can never finish; mark it so history stays honest.
  db.prepare(
    "UPDATE akira_runs SET status = 'failed', error = 'Server berhenti sebelum selesai.', finished_at = ? WHERE status = 'running'",
  ).run(Date.now());
  const get = (id: string) => {
    const row = db.prepare('SELECT * FROM akira_runs WHERE id = ?').get(id) as
      Row | undefined;
    return row ? toRun(row) : null;
  };
  return {
    get,
    list: (limit: number) =>
      (
        db
          .prepare(
            'SELECT * FROM akira_runs ORDER BY created_at DESC, id LIMIT ?',
          )
          .all(limit) as Row[]
      ).map(toRun),
    start(instruction: string) {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO akira_runs (id, agent, instruction, status, created_at) VALUES (?, 'akira', ?, 'running', ?)",
      ).run(id, instruction, Date.now());
      return id;
    },
    finish(
      id: string,
      result: {
        answer: string;
        model: string;
        tokens: { prompt: number; completion: number; total: number } | null;
        ms: number;
      },
    ) {
      db.prepare(
        "UPDATE akira_runs SET status = 'completed', answer = ?, model = ?, prompt_tokens = ?, completion_tokens = ?, total_tokens = ?, duration_ms = ?, finished_at = ? WHERE id = ?",
      ).run(
        result.answer,
        result.model,
        result.tokens?.prompt ?? null,
        result.tokens?.completion ?? null,
        result.tokens?.total ?? null,
        result.ms,
        Date.now(),
        id,
      );
    },
    fail(id: string, error: string, ms: number) {
      db.prepare(
        "UPDATE akira_runs SET status = 'failed', error = ?, duration_ms = ?, finished_at = ? WHERE id = ?",
      ).run(error, ms, Date.now(), id);
    },
  };
}

type Deps = {
  hermes: Hermes;
  agents: Agents;
  db: DatabaseSync;
  audit: (action: string, detail: string) => void;
  announce: () => void;
};

const askBody = z.object({
  instruction: z.string().trim().min(2, 'Instruksi terlalu pendek').max(4000),
});

// What the Agent Management page shows for Akira's runtime: only what was verified.
export function akiraRuntime(
  hermes: Hermes,
  busy: () => boolean,
): { status: 'ready' | 'running' | 'not_connected'; reason: string } {
  const h = hermes.health;
  if (!h.configured) return { status: 'not_connected', reason: h.reason };
  if (!h.connected || !h.safe)
    return { status: 'not_connected', reason: h.reason };
  return busy()
    ? { status: 'running', reason: 'Akira sedang memproses instruksi.' }
    : { status: 'ready', reason: `Hermes terhubung (${h.model ?? 'akira'}).` };
}

export function createAkira(deps: Deps) {
  const runs = createRuns(deps.db);
  let busy = false;
  return {
    runs,
    isBusy: () => busy,
    setBusy: (value: boolean) => (busy = value),
  };
}

export function registerAkiraRoutes(
  app: FastifyInstance,
  deps: Deps,
  akira: ReturnType<typeof createAkira>,
) {
  const { hermes, agents, audit, announce } = deps;

  app.get('/hermes/status', async () => {
    const health = await hermes.check();
    return { ...health, running: akira.isBusy() };
  });

  app.get('/akira/runs', (request) => {
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(200).default(50) })
      .parse(request.query);
    return { runs: akira.runs.list(limit) };
  });

  // Leo's instruction goes to Akira through Hermes. Phase 1: Akira answers; she plans and
  // delegates in phase 2. Every guard below refuses with a reason instead of faking a result.
  app.post('/akira/ask', async (request, reply) => {
    const body = askBody.safeParse(request.body);
    if (!body.success)
      return reply
        .code(400)
        .send({ error: body.error.issues[0]?.message ?? 'Input tidak valid.' });
    const refuse = (error: string, code = 409) =>
      reply.code(code).send({ error });

    const agent = agents.get('akira');
    if (!agent) return refuse('Agent Akira tidak ada.');
    if (!agent.enabled) return refuse('Akira sedang dinonaktifkan.');
    if (agent.config.provider !== 'hermes' || agent.config.model !== 'akira')
      return refuse(
        'Atur Akira ke provider Hermes dan model akira di halaman Tim & agent.',
      );
    if (agent.config.limits.tokenBudget <= 0)
      return refuse('Anggaran token Akira masih 0. Atur di Resource Limits.');
    if (!hermes.configured)
      return refuse(
        'HERMES_API_URL dan HERMES_API_KEY belum diatur di server.',
      );
    if (akira.isBusy())
      return refuse('Akira sedang memproses instruksi lain.', 429);

    akira.setBusy(true);
    const id = akira.runs.start(body.data.instruction);
    audit('akira.ask', `${id} ${body.data.instruction.length} karakter`);
    announce();
    const started = Date.now();
    try {
      const health = await hermes.check();
      if (!health.connected) throw new HermesError(health.reason, 502);
      if (!health.safe) throw new HermesError(health.reason, 409);
      const answer = await hermes.chat({
        system: agent.config.systemPrompt,
        user: body.data.instruction,
        maxTokens: Math.min(
          agent.config.maxOutputTokens ?? 2000,
          agent.config.limits.tokenBudget,
        ),
      });
      akira.runs.finish(id, {
        answer: answer.text,
        model: answer.model,
        tokens: answer.usage,
        ms: answer.ms,
      });
      audit('akira.answer', `${id} ${answer.usage?.total ?? '?'} token`);
      return reply.code(201).send({ run: akira.runs.get(id) });
    } catch (error) {
      const message =
        error instanceof HermesError
          ? error.message
          : 'Terjadi kesalahan saat menghubungi Hermes.';
      akira.runs.fail(id, message, Date.now() - started);
      audit('akira.failed', `${id} ${message}`);
      return reply
        .code(error instanceof HermesError ? error.status : 502)
        .send({ error: message, run: akira.runs.get(id) });
    } finally {
      akira.setBusy(false);
      announce();
    }
  });
}
