import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Agents } from './agents.js';
import {
  SHARED_AREAS,
  VaultError,
  checkContent,
  cleanPath,
  hashOf,
  refusal,
  type Vault,
} from './vault.js';

export const memorySchema = `
CREATE TABLE IF NOT EXISTS memory_proposals (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  reason TEXT NOT NULL,
  base_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
`;

type Row = Record<string, string | number | null>;
const toProposal = (r: Row) => ({
  id: String(r.id),
  agent: String(r.agent),
  path: String(r.path),
  content: String(r.content),
  reason: String(r.reason),
  // True when the note this proposal replaces has changed since it was written.
  baseHash: r.base_hash === null ? null : String(r.base_hash),
  status: String(r.status) as 'pending' | 'approved' | 'rejected',
  createdAt: Number(r.created_at),
  decidedAt: r.decided_at === null ? null : Number(r.decided_at),
});
type Proposal = ReturnType<typeof toProposal>;

function createProposals(db: DatabaseSync) {
  return {
    list: (status?: string) =>
      (
        db
          .prepare(
            `SELECT * FROM memory_proposals ${status ? 'WHERE status = ?' : ''} ORDER BY created_at DESC LIMIT 200`,
          )
          .all(...(status ? [status] : [])) as Row[]
      ).map(toProposal),
    get(id: string): Proposal | null {
      const row = db
        .prepare('SELECT * FROM memory_proposals WHERE id = ?')
        .get(id) as Row | undefined;
      return row ? toProposal(row) : null;
    },
    create(
      agent: string,
      path: string,
      content: string,
      reason: string,
      baseHash: string | null,
    ) {
      const id = randomUUID();
      db.prepare(
        'INSERT INTO memory_proposals (id, agent, path, content, reason, base_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(id, agent, path, content, reason, baseHash, Date.now());
      return id;
    },
    // Only a pending proposal can be decided, and only once.
    decide: (id: string, status: 'approved' | 'rejected') =>
      db
        .prepare(
          "UPDATE memory_proposals SET status = ?, decided_at = ? WHERE id = ? AND status = 'pending'",
        )
        .run(status, Date.now(), id).changes > 0,
  };
}

type Deps = {
  vault: Vault | null;
  agents: Agents;
  db: DatabaseSync;
  audit: (action: string, detail: string) => void;
  announce: () => void;
};

const actor = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const noteBody = z.object({
  as: actor,
  path: z.string().max(400),
  content: z.string().max(70_000),
  // The hash of the note when it was read; null means "a new note".
  expectedHash: z.string().length(64).nullable(),
});
const proposalBody = z.object({
  as: actor,
  path: z.string().max(400),
  content: z.string().max(70_000),
  reason: z.string().trim().min(3).max(500),
});
const lessonBody = z.object({
  as: actor,
  kind: z.enum(['error', 'solution', 'decision', 'evaluation']),
  title: z.string().trim().min(3).max(80),
  body: z.string().trim().min(3).max(8000),
});
const decisionBody = z.object({ decision: z.enum(['approve', 'reject']) });

const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'catatan';

export function registerMemoryRoutes(app: FastifyInstance, deps: Deps) {
  const { vault, agents, audit, announce } = deps;
  const proposals = createProposals(deps.db);

  // Nothing here is an agent run: the session is Leo's, and `as` names whose rights apply.
  const ready = (reply: FastifyReply) => {
    if (vault) return vault;
    reply.code(409).send({
      error:
        'Memori Obsidian belum diatur: isi OBSIDIAN_VAULT_PATH di .env server.',
    });
    return null;
  };
  const fail = (reply: FastifyReply, error: unknown) => {
    if (error instanceof VaultError)
      return reply.code(error.status).send({ error: error.message });
    throw error;
  };
  const rightsOf = (as: string) => {
    if (as === 'leo')
      return { memory: undefined, error: null as string | null };
    const agent = agents.get(as);
    if (!agent) return { memory: undefined, error: 'Agent tidak ditemukan.' };
    if (!agent.enabled)
      return { memory: undefined, error: 'Agent sedang dinonaktifkan.' };
    return { memory: agent.config.memory, error: null };
  };
  // Runs one memory event: the log line is best effort, the audit entry is not.
  const record = (v: Vault, action: string, detail: string) => {
    audit(action, detail);
    try {
      v.log(`${action} ${detail}`);
    } catch {
      // A full disk or locked log file must not undo a note that was already saved.
    }
    announce();
  };

  app.get('/memory/status', () => {
    const pending = proposals.list('pending').length;
    if (!vault)
      return {
        configured: false,
        message: 'OBSIDIAN_VAULT_PATH belum diatur.',
        pendingProposals: pending,
      };
    const notes = vault.list();
    return {
      configured: true,
      vault: vault.root,
      notes: notes.length,
      pendingProposals: pending,
      learning: {
        automatic: false,
        note: 'Memori tidak otomatis dimasukkan ke prompt agent; itu fase berikutnya setelah evaluasi.',
      },
    };
  });

  app.post('/memory/init', async (_request, reply) => {
    const v = ready(reply);
    if (!v) return reply;
    const made = v.init(agents.list().map((a) => a.id));
    record(v, 'memory.init', `${made.length} file`);
    return { created: made };
  });

  app.get('/memory/tree', async (request, reply) => {
    const v = ready(reply);
    if (!v) return reply;
    const { prefix } = z
      .object({ prefix: z.string().max(200).default('') })
      .parse(request.query);
    return { notes: v.list(prefix) };
  });

  app.get('/memory/note', async (request, reply) => {
    const v = ready(reply);
    if (!v) return reply;
    const q = z
      .object({ path: z.string().max(400), as: actor.default('leo') })
      .safeParse(request.query);
    if (!q.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    try {
      const path = cleanPath(q.data.path);
      const rights = rightsOf(q.data.as);
      const denied =
        rights.error ?? refusal(q.data.as, path, 'read', rights.memory);
      if (denied) return reply.code(403).send({ error: denied });
      return v.read(path);
    } catch (error) {
      return fail(reply, error);
    }
  });

  // Direct write: Leo anywhere in the areas, an agent only in its own folder.
  app.put('/memory/note', async (request, reply) => {
    const v = ready(reply);
    if (!v) return reply;
    const body = noteBody.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    try {
      const path = cleanPath(body.data.path);
      const rights = rightsOf(body.data.as);
      const denied =
        rights.error ?? refusal(body.data.as, path, 'write', rights.memory);
      if (denied) return reply.code(403).send({ error: denied });
      const saved = v.write(path, body.data.content, body.data.expectedHash);
      record(v, 'memory.write', `${body.data.as} ${path}`);
      return reply.code(saved.created ? 201 : 200).send(saved);
    } catch (error) {
      return fail(reply, error);
    }
  });

  // Anything beyond an agent's own folder is a proposal: validated now, written only if approved.
  app.post('/memory/proposals', async (request, reply) => {
    const v = ready(reply);
    if (!v) return reply;
    const body = proposalBody.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    try {
      const path = cleanPath(body.data.path);
      const rights = rightsOf(body.data.as);
      const denied =
        rights.error ?? refusal(body.data.as, path, 'propose', rights.memory);
      if (denied) return reply.code(403).send({ error: denied });
      checkContent(body.data.content);
      const id = proposals.create(
        body.data.as,
        path,
        body.data.content,
        body.data.reason,
        v.hashNow(path),
      );
      record(v, 'memory.propose', `${body.data.as} ${path}`);
      return reply.code(201).send({ proposal: proposals.get(id) });
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.get('/memory/proposals', (request) => {
    const { status } = z
      .object({
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
      })
      .parse(request.query);
    // A pending proposal is stale when the note it would replace has changed since it was written.
    const stale = (p: ReturnType<typeof proposals.get> & object) => {
      if (!vault || p.status !== 'pending') return false;
      try {
        return vault.hashNow(p.path) !== p.baseHash;
      } catch {
        return true;
      }
    };
    return {
      proposals: proposals.list(status).map((p) => ({ ...p, stale: stale(p) })),
    };
  });

  app.post('/memory/proposals/:id/decision', async (request, reply) => {
    const v = ready(reply);
    if (!v) return reply;
    const body = decisionBody.safeParse(request.body);
    const id = z
      .string()
      .uuid()
      .safeParse((request.params as { id: string }).id);
    const proposal = id.success ? proposals.get(id.data) : null;
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    if (!proposal)
      return reply.code(404).send({ error: 'Usulan tidak ditemukan.' });
    if (proposal.status !== 'pending')
      return reply.code(409).send({ error: 'Usulan ini sudah diputuskan.' });
    try {
      if (body.data.decision === 'approve') {
        // Checked again: the agent may have been changed, and the note may have moved on.
        const area = proposal.path.split('/')[0]!;
        if (!SHARED_AREAS.includes(area))
          throw new VaultError('Area usulan tidak valid.');
        v.write(proposal.path, proposal.content, proposal.baseHash);
      }
      proposals.decide(
        proposal.id,
        body.data.decision === 'approve' ? 'approved' : 'rejected',
      );
      record(
        v,
        body.data.decision === 'approve' ? 'memory.approve' : 'memory.reject',
        `${proposal.agent} ${proposal.path}`,
      );
      return { proposal: proposals.get(proposal.id) };
    } catch (error) {
      return fail(reply, error);
    }
  });

  // A lesson is a dated note in the agent's own folder: what went wrong, what worked, what was
  // decided, how it turned out. It starts as "belum dievaluasi"; nothing reads it back on its own.
  app.post('/memory/lessons', async (request, reply) => {
    const v = ready(reply);
    if (!v) return reply;
    const body = lessonBody.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    const { as, kind, title, body: text } = body.data;
    if (as === 'leo')
      return reply
        .code(400)
        .send({ error: 'Pelajaran dicatat atas nama agent.' });
    try {
      const rights = rightsOf(as);
      const folder = `Agents/${as}/Lessons`;
      const denied =
        rights.error ?? refusal(as, `${folder}/x.md`, 'write', rights.memory);
      if (denied) return reply.code(403).send({ error: denied });
      const day = new Date().toISOString().slice(0, 10);
      const stem = `${day}-${kind}-${slug(title)}`;
      let path = `${folder}/${stem}.md`;
      for (let n = 2; v.hashNow(path) !== null; n++)
        path = `${folder}/${stem}-${n}.md`;
      const note = `---\ntype: lesson\nkind: ${kind}\nagent: ${as}\ncreated: ${new Date().toISOString()}\nstatus: belum dievaluasi\n---\n\n# ${title.replaceAll('\n', ' ')}\n\n${text}\n`;
      v.write(path, note, null);
      record(v, 'memory.lesson', `${as} ${path}`);
      return reply.code(201).send({ path, hash: hashOf(note) });
    } catch (error) {
      return fail(reply, error);
    }
  });
}
