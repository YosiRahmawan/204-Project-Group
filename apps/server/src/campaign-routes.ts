import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  GENERATE_KINDS,
  applyDraft,
  campaignInputSchema,
  platformLabel,
  type CampaignView,
  type GenerateKind,
} from '@204/contracts';
import { catalogOf, type Agents, type Registry } from './agents.js';
import { AiError, askClaude, extractJson } from './ai.js';
import type { Campaigns } from './campaigns.js';

type Deps = {
  campaigns: Campaigns;
  agents: Agents;
  registry: Registry;
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  audit: (action: string, detail: string) => void;
  announce: () => void;
};

const id = z.string().uuid();
const createBody = z.object({ config: z.unknown() });
const updateBody = z.object({
  version: z.number().int().min(1),
  config: z.unknown(),
});
const versionBody = z.object({ version: z.number().int().min(1) });
const generateBody = z.object({
  version: z.number().int().min(1),
  kind: z.enum(GENERATE_KINDS),
});

// Which agent drafts what: copy goes to Aeri, the visual plan to Kuro.
const writer: Record<GenerateKind, string> = {
  script: 'aeri',
  caption: 'aeri',
  storyboard: 'kuro',
};
const task: Record<GenerateKind, string> = {
  script:
    'Tulis 3 hook pembuka, satu script video vertikal 15-30 detik, dan satu CTA. Balas JSON: {"hooks": string[], "script": string, "cta": string}',
  caption:
    'Tulis satu caption dan 5-10 hashtag yang relevan. Balas JSON: {"caption": string, "hashtags": string[]}',
  storyboard:
    'Buat storyboard 4-8 scene untuk video vertikal 9:16. Balas JSON: {"storyboard": [{"visual": string, "voiceover": string, "seconds": number}]}',
};

export function registerCampaignRoutes(app: FastifyInstance, deps: Deps) {
  const { campaigns, agents, registry, env, audit, announce } = deps;
  const notFound = (reply: FastifyReply) =>
    reply.code(404).send({ error: 'Campaign tidak ditemukan.' });
  const stale = (reply: FastifyReply) =>
    reply.code(409).send({
      error: 'Campaign sudah diubah di tempat lain. Muat ulang lalu coba lagi.',
    });
  const invalid = (reply: FastifyReply, raw: unknown) => {
    const parsed = campaignInputSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'config'] ??= issue.message;
    reply.code(400).send({ error: 'Isi campaign tidak valid.', fields });
    return null;
  };

  app.get('/campaigns', () => ({ campaigns: campaigns.list() }));
  app.get('/campaigns/:id', (request, reply) => {
    const found = id.safeParse((request.params as { id: string }).id);
    const campaign = found.success ? campaigns.get(found.data) : null;
    return campaign ? { campaign } : notFound(reply);
  });

  app.post('/campaigns', async (request, reply) => {
    const body = createBody.safeParse(request.body);
    const config = body.success
      ? invalid(reply, body.data.config)
      : (reply.code(400).send({ error: 'Input tidak valid.' }), null);
    if (!config) return reply;
    const campaign = campaigns.create(config);
    audit('campaign.create', campaign.id);
    announce();
    return reply.code(201).send({ campaign });
  });

  app.put('/campaigns/:id', async (request, reply) => {
    const found = id.safeParse((request.params as { id: string }).id);
    const body = updateBody.safeParse(request.body);
    if (!found.success) return notFound(reply);
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    const config = invalid(reply, body.data.config);
    if (!config) return reply;
    const saved = campaigns.update(found.data, body.data.version, config);
    if (saved === 'missing') return notFound(reply);
    if (saved === 'stale') return stale(reply);
    audit('campaign.update', `${found.data} v${saved.version}`);
    announce();
    return { campaign: saved };
  });

  app.post('/campaigns/:id/approve', async (request, reply) => {
    const found = id.safeParse((request.params as { id: string }).id);
    const body = versionBody.safeParse(request.body);
    if (!found.success) return notFound(reply);
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    const saved = campaigns.approve(found.data, body.data.version);
    if (saved === 'missing') return notFound(reply);
    if (saved === 'stale') return stale(reply);
    audit('campaign.approve', `${found.data} v${saved.version}`);
    announce();
    return { campaign: saved };
  });

  app.delete('/campaigns/:id', async (request, reply) => {
    const found = id.safeParse((request.params as { id: string }).id);
    if (!found.success || !campaigns.remove(found.data)) return notFound(reply);
    audit('campaign.delete', found.data);
    announce();
    return reply.code(204).send();
  });

  // Asks the responsible agent for a draft. The draft replaces only the asked part of the
  // content, is marked as AI output, and is never approved or published by itself.
  app.post('/campaigns/:id/generate', async (request, reply) => {
    const found = id.safeParse((request.params as { id: string }).id);
    const body = generateBody.safeParse(request.body);
    if (!found.success) return notFound(reply);
    if (!body.success)
      return reply.code(400).send({ error: 'Input tidak valid.' });
    const campaign = campaigns.get(found.data);
    if (!campaign) return notFound(reply);
    if (campaign.version !== body.data.version) return stale(reply);

    const agent = agents.get(writer[body.data.kind]);
    const refuse = (error: string) => reply.code(409).send({ error });
    if (!agent) return refuse('Agent yang dibutuhkan tidak ada.');
    const name = agent.config.displayName;
    if (!agent.enabled) return refuse(`${name} sedang dinonaktifkan.`);
    const { provider, model } = agent.config;
    if (provider !== 'anthropic' || !model)
      return refuse(
        `${name} belum diatur ke provider Anthropic dan model di halaman Tim & agent.`,
      );
    const known = catalogOf(registry, env).providers.find(
      (p) => p.id === provider,
    );
    if (!known?.models.some((m) => m.id === model))
      return refuse(`Model ${name} tidak ada di registry.`);
    const apiKey = env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return refuse('ANTHROPIC_API_KEY belum diatur di server.');
    if (agent.config.limits.tokenBudget <= 0)
      return refuse(`Anggaran token ${name} masih 0. Atur di Resource Limits.`);

    const c = campaign.config;
    // The product text is Leo's own input, but it is passed as data, not as instructions.
    const prompt = [
      task[body.data.kind],
      'Bahasa Indonesia. Jangan membuat klaim, harga, atau testimoni yang tidak ada di data. Balas hanya JSON.',
      '<produk>',
      JSON.stringify({
        platform: platformLabel[c.platform],
        nama: c.product.name,
        hargaRp: c.product.priceIdr,
        manfaat: c.product.benefits,
        targetPembeli: c.product.targetBuyer,
        catatan: c.product.notes,
      }),
      '</produk>',
    ].join('\n');
    try {
      const text = await askClaude({
        apiKey,
        model,
        system: agent.config.systemPrompt,
        prompt,
        maxTokens: Math.min(
          agent.config.maxOutputTokens ?? 2000,
          agent.config.limits.tokenBudget,
        ),
        ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
      });
      const content = applyDraft(c.content, body.data.kind, extractJson(text));
      const saved = campaigns.applyAiDraft(found.data, body.data.version, {
        ...c,
        content,
      });
      if (typeof saved === 'string')
        return saved === 'stale' ? stale(reply) : notFound(reply);
      audit('campaign.generate', `${found.data} ${body.data.kind} ${agent.id}`);
      announce();
      return { campaign: saved as CampaignView };
    } catch (error) {
      const message =
        error instanceof AiError
          ? error.message
          : 'Jawaban AI tidak sesuai format yang diharapkan.';
      audit('campaign.generate_failed', `${found.data} ${body.data.kind}`);
      return reply.code(502).send({ error: message });
    }
  });
}
