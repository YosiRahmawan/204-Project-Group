import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  MANDATORY_APPROVALS,
  OPTIONAL_APPROVALS,
  PERMISSIONS,
  TOOLS,
  agentId,
  agentInputSchema,
  checkAgent,
  defaultPrompt,
  normalizeAgent,
  ENGINE_MESSAGE,
  type AgentInput,
  type AgentView,
} from '@204/contracts';
import { catalogOf, viewOf, type Agents, type Registry } from './agents.js';

type Deps = {
  agents: Agents;
  registry: Registry;
  env: Record<string, string | undefined>;
  audit: (action: string, detail: string) => void;
  announce: () => void;
  // A runtime verified by an adapter for one agent (Akira via Hermes); null means none exists.
  runtimeOf?: (id: string) => AgentView['runtime'] | null;
};

const createBody = z.object({ config: z.unknown() });
const updateBody = z.object({
  version: z.number().int().min(1),
  config: z.unknown(),
});
const enabledBody = z.object({ enabled: z.boolean() });
const idParam = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);

// Every agent route is Leo-only: the app's session hook has already run by the time we get here.
export function registerAgentRoutes(app: FastifyInstance, deps: Deps) {
  const { agents, registry, env, audit, announce } = deps;
  // No execution engine exists yet; when one does, only it may flip this to true.
  const engine = { available: false };

  const catalog = () => catalogOf(registry, env);
  // A disabled agent stays "disabled"; otherwise a verified adapter runtime replaces the default.
  const present = (
    agent: ReturnType<typeof agents.list>[number],
    all: ReturnType<typeof agents.list>,
  ) => {
    const base = viewOf(agent, catalog(), all, engine);
    const runtime = agent.enabled ? deps.runtimeOf?.(agent.id) : null;
    return runtime ? { ...base, runtime } : base;
  };
  const view = (id: string) => {
    const all = agents.list();
    const agent = all.find((a) => a.id === id);
    return agent ? present(agent, all) : null;
  };
  const invalid = (reply: FastifyReply, fields: Record<string, string>) =>
    reply.code(400).send({ error: 'Konfigurasi tidak valid.', fields });
  const notFound = (reply: FastifyReply) =>
    reply.code(404).send({ error: 'Agent tidak ditemukan.' });

  // Shape first (Zod), then the cross-field rules; the server also forces the mandatory approvals.
  const validate = (
    raw: unknown,
    selfId?: string,
  ): { config: AgentInput } | { fields: Record<string, string> } => {
    const parsed = agentInputSchema.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        fields[issue.path.join('.') || 'config'] ??= issue.message;
      return { fields };
    }
    const config = normalizeAgent(parsed.data);
    const all = agents.list();
    const issues = checkAgent(config, catalog(), {
      selfId,
      ids: all.map((a) => a.id),
      reportsToOf: Object.fromEntries(
        all.map((a) => [a.id, a.config.reportsTo]),
      ),
    });
    if (issues.length) {
      const fields: Record<string, string> = {};
      for (const i of issues) fields[i.path] ??= i.message;
      return { fields };
    }
    return { config };
  };

  const changed = (a: AgentInput, b: AgentInput) =>
    (Object.keys(a) as (keyof AgentInput)[])
      .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
      .join(',');

  app.get('/agents', () => {
    const all = agents.list();
    const cat = catalog();
    return {
      agents: all.map((a) => present(a, all)),
      meta: {
        providers: cat.providers,
        permissions: PERMISSIONS,
        tools: TOOLS,
        mandatoryApprovals: MANDATORY_APPROVALS,
        optionalApprovals: OPTIONAL_APPROVALS,
        engine: { available: engine.available, message: ENGINE_MESSAGE },
      },
    };
  });

  app.get('/agents/:id', (request, reply) => {
    const id = idParam.safeParse((request.params as { id: string }).id);
    const found = id.success ? view(id.data) : null;
    if (!found) return notFound(reply);
    return {
      agent: found,
      promptHistory: agents.prompts(found.id).slice(0, 10),
    };
  });

  app.post('/agents', async (request, reply) => {
    const body = createBody.safeParse(request.body);
    if (!body.success)
      return invalid(reply, { config: 'Isi permintaan tidak valid.' });
    const result = validate(body.data.config);
    if ('fields' in result) return invalid(reply, result.fields);
    const id = agentId(result.config.name);
    if (agents.taken(id))
      return invalid(reply, {
        name: 'Nama atau ID ini sudah dipakai agent lain.',
      });
    agents.create(result.config);
    audit('agent.create', id);
    announce();
    return reply.code(201).send({ agent: view(id) });
  });

  app.put('/agents/:id', async (request, reply) => {
    const id = idParam.safeParse((request.params as { id: string }).id);
    const body = updateBody.safeParse(request.body);
    if (!id.success) return notFound(reply);
    if (!body.success)
      return invalid(reply, { config: 'Isi permintaan tidak valid.' });
    const current = agents.get(id.data);
    if (!current) return notFound(reply);
    const result = validate(body.data.config, id.data);
    if ('fields' in result) return invalid(reply, result.fields);
    // The name is the agent's identity (its id comes from it), so it is fixed after creation.
    if (agentId(result.config.name) !== id.data)
      return invalid(reply, {
        name: 'Nama agent tidak bisa diubah setelah dibuat.',
      });
    const saved = agents.update(id.data, result.config, body.data.version);
    if (saved === 'stale')
      return reply.code(409).send({
        error: 'Agent sudah diubah di tempat lain. Muat ulang lalu coba lagi.',
      });
    if (saved === 'missing') return notFound(reply);
    audit(
      'agent.update',
      `${id.data} v${saved.version} ${changed(current.config, result.config)}`,
    );
    announce();
    return { agent: view(id.data) };
  });

  app.patch('/agents/:id/enabled', async (request, reply) => {
    const id = idParam.safeParse((request.params as { id: string }).id);
    const body = enabledBody.safeParse(request.body);
    if (!id.success) return notFound(reply);
    if (!body.success)
      return invalid(reply, { enabled: 'Harus true atau false.' });
    const saved = agents.setEnabled(id.data, body.data.enabled);
    if (!saved) return notFound(reply);
    audit(body.data.enabled ? 'agent.enable' : 'agent.disable', id.data);
    announce();
    return { agent: view(id.data) };
  });

  app.post('/agents/:id/prompt/reset', async (request, reply) => {
    const id = idParam.safeParse((request.params as { id: string }).id);
    const current = id.success ? agents.get(id.data) : null;
    if (!id.success || !current) return notFound(reply);
    const config = {
      ...current.config,
      systemPrompt: defaultPrompt(current.config),
    };
    const saved = agents.update(id.data, config, current.version);
    if (typeof saved === 'string')
      return reply.code(409).send({ error: 'Muat ulang lalu coba lagi.' });
    audit('agent.prompt_reset', `${id.data} v${saved.version}`);
    announce();
    return { agent: view(id.data) };
  });

  app.delete('/agents/:id', async (request, reply) => {
    const id = idParam.safeParse((request.params as { id: string }).id);
    if (!id.success) return notFound(reply);
    const done = agents.remove(id.data);
    if (done === 'missing') return notFound(reply);
    if (done === 'built_in')
      return reply
        .code(409)
        .send({ error: 'Agent bawaan tidak bisa dihapus. Nonaktifkan saja.' });
    if (done === 'has_reports')
      return reply.code(409).send({
        error: 'Masih ada agent yang melapor ke agent ini. Pindahkan dulu.',
      });
    audit('agent.delete', id.data);
    announce();
    return reply.code(204).send();
  });
}
