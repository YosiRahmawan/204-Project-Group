import { describe, expect, it } from 'vitest';
import {
  MANDATORY_APPROVALS,
  agentId,
  agentInputSchema,
  checkAgent,
  configStatus,
  defaultAgents,
  normalizeAgent,
  runtimeStatus,
  type Catalog,
} from './agents.js';

const catalog: Catalog = {
  providers: [
    {
      id: 'anthropic',
      label: 'Anthropic',
      keyConfigured: false,
      models: [
        {
          id: 'm1',
          label: 'M1',
          supportsTemperature: false,
          maxOutputTokens: 1000,
        },
      ],
    },
  ],
};
const ids = defaultAgents.map((a) => agentId(a.name));
const akira = defaultAgents[0]!;
const check = (patch: Partial<typeof akira>, selfId = 'akira') =>
  checkAgent({ ...akira, ...patch }, catalog, { selfId, ids }).map(
    (i) => i.path,
  );

describe('default agents', () => {
  it('are six valid agents with Leo above Akira', () => {
    expect(defaultAgents).toHaveLength(6);
    for (const a of defaultAgents) {
      expect(agentInputSchema.safeParse(a).success).toBe(true);
      expect(checkAgent(a, catalog, { ids })).toEqual([]);
    }
    expect(akira.reportsTo).toBe('leo');
    expect(defaultAgents.filter((a) => a.reportsTo === 'akira')).toHaveLength(
      5,
    );
  });
  it('start not configured, least-privilege, with every mandatory approval', () => {
    for (const a of defaultAgents) {
      expect(configStatus(a, catalog, { ids }).status).toBe('not_configured');
      expect(a.permissions.access_allowed_tools).toBe(false);
      expect(a.permissions.request_external_action).toBe(false);
      for (const m of MANDATORY_APPROVALS) expect(a.approvals).toContain(m.id);
    }
  });
});

describe('checkAgent', () => {
  it('refuses the name leo', () =>
    expect(check({ name: 'Leo' }, 'leo')).toContain('name'));
  it('refuses unknown provider or model', () => {
    expect(check({ provider: 'nope', model: 'x' })).toContain('provider');
    expect(check({ provider: 'anthropic', model: 'x' })).toContain('model');
    expect(check({ provider: 'anthropic', model: null })).toContain('model');
  });
  it('accepts a model from the registry and rejects temperature it does not support', () => {
    expect(check({ provider: 'anthropic', model: 'm1' })).toEqual([]);
    expect(
      check({ provider: 'anthropic', model: 'm1', temperature: 0.5 }),
    ).toContain('temperature');
    expect(
      check({ provider: 'anthropic', model: 'm1', maxOutputTokens: 5000 }),
    ).toContain('maxOutputTokens');
  });
  it('needs a model and a budget before leaving propose-only', () => {
    expect(check({ executionMode: 'supervised' })).toContain('executionMode');
    const ok = {
      provider: 'anthropic',
      model: 'm1',
      executionMode: 'supervised' as const,
    };
    expect(check(ok)).toContain('executionMode');
    expect(
      check({
        ...ok,
        limits: { tokenBudget: 10, spendingLimitUsd: 1, maxConcurrentTasks: 1 },
      }),
    ).toEqual([]);
  });
  it('ties tools and knowledge to permissions', () => {
    expect(check({ allowedTools: ['web.search'] })).toContain('allowedTools');
    expect(
      check({
        permissions: {
          ...akira.permissions,
          propose_shared_knowledge_update: true,
        },
      }),
    ).toContain('permissions');
  });
  it('rejects self, unknown managers and loops', () => {
    expect(check({ reportsTo: 'akira' })).toContain('reportsTo');
    expect(check({ reportsTo: 'ghost' })).toContain('reportsTo');
    const loop = checkAgent({ ...akira, reportsTo: 'kuro' }, catalog, {
      selfId: 'akira',
      ids,
      reportsToOf: { kuro: 'akira' },
    });
    expect(loop.map((i) => i.message).join()).toMatch(/lingkaran/);
  });
});

describe('normalize and status', () => {
  it('always adds mandatory approvals, however the form sent them', () => {
    const n = normalizeAgent({ ...akira, approvals: [] });
    for (const m of MANDATORY_APPROVALS) expect(n.approvals).toContain(m.id);
  });
  it('never reports a runtime state that was not verified', () => {
    expect(runtimeStatus(false, { available: false }, true).status).toBe(
      'disabled',
    );
    expect(runtimeStatus(true, { available: false }, true).status).toBe(
      'not_connected',
    );
  });
  it('builds ids from names', () =>
    expect(agentId(' Dr. Nova 2 ')).toBe('dr-nova-2'));
});
