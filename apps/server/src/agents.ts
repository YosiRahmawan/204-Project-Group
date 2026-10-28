import type { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  agentId,
  configStatus,
  defaultAgents,
  runtimeStatus,
  type AgentInput,
  type AgentView,
  type Catalog,
} from '@204/contracts';

export const agentSchema = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  built_in INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS agent_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  at INTEGER NOT NULL,
  prompt TEXT NOT NULL
);
`;

const registrySchema = z.object({
  providers: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      keyEnv: z.string(),
      models: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          supportsTemperature: z.boolean(),
          maxOutputTokens: z.number().int().positive().nullable(),
        }),
      ),
    }),
  ),
});
export type Registry = z.infer<typeof registrySchema>;

export function loadRegistry(path: string): Registry {
  return registrySchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

// The catalog sent to the browser: which providers exist and whether the server holds a key
// for them. The key itself is read here only to test that it is set, and never returned.
export function catalogOf(
  registry: Registry,
  env: Record<string, string | undefined>,
): Catalog {
  return {
    providers: registry.providers.map(({ keyEnv, ...p }) => ({
      ...p,
      keyConfigured: Boolean(env[keyEnv]?.trim()),
    })),
  };
}

type Row = Record<string, string | number | null>;
const MAX_PROMPT_VERSIONS = 20;

export function createAgents(db: DatabaseSync) {
  const tx = <T>(work: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = work();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const toRecord = (r: Row) => ({
    id: String(r.id),
    builtIn: r.built_in === 1,
    enabled: r.enabled === 1,
    config: JSON.parse(String(r.config)) as AgentInput,
    version: Number(r.version),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  });
  type Record_ = ReturnType<typeof toRecord>;

  const addPrompt = (id: string, prompt: string, at: number) => {
    db.prepare(
      'INSERT INTO agent_prompts (agent_id, at, prompt) VALUES (?, ?, ?)',
    ).run(id, at, prompt);
    db.prepare(
      `DELETE FROM agent_prompts WHERE agent_id = ? AND id NOT IN
       (SELECT id FROM agent_prompts WHERE agent_id = ? ORDER BY id DESC LIMIT ?)`,
    ).run(id, id, MAX_PROMPT_VERSIONS);
  };

  const self = {
    // Safe to run on every start: an agent that exists (even one Leo edited or deleted) is left alone.
    seed(now = Date.now()) {
      tx(() => {
        // Each gets a later timestamp so the list keeps the team's order.
        for (const [index, config] of defaultAgents.entries()) {
          const id = agentId(config.name);
          const done = db
            .prepare(
              `INSERT OR IGNORE INTO agents (id, built_in, enabled, config, version, created_at, updated_at)
               VALUES (?, 1, ?, ?, 1, ?, ?)`,
            )
            .run(
              id,
              config.enabled ? 1 : 0,
              JSON.stringify(config),
              now + index,
              now + index,
            );
          if (done.changes) addPrompt(id, config.systemPrompt, now);
        }
      });
    },

    list(): Record_[] {
      return (
        db
          .prepare(
            'SELECT * FROM agents WHERE deleted_at IS NULL ORDER BY built_in DESC, created_at, id',
          )
          .all() as Row[]
      ).map(toRecord);
    },
    get(id: string): Record_ | null {
      const row = db
        .prepare('SELECT * FROM agents WHERE id = ? AND deleted_at IS NULL')
        .get(id) as Row | undefined;
      return row ? toRecord(row) : null;
    },
    // Ids that were ever used, deleted ones included, so a name is never silently reused.
    taken(id: string) {
      return Boolean(db.prepare('SELECT 1 FROM agents WHERE id = ?').get(id));
    },
    prompts(id: string) {
      return (
        db
          .prepare(
            'SELECT at, prompt FROM agent_prompts WHERE agent_id = ? ORDER BY id DESC',
          )
          .all(id) as Row[]
      ).map((r) => ({ at: Number(r.at), prompt: String(r.prompt) }));
    },

    create(config: AgentInput, now = Date.now()) {
      const id = agentId(config.name);
      tx(() => {
        db.prepare(
          `INSERT INTO agents (id, built_in, enabled, config, version, created_at, updated_at)
           VALUES (?, 0, ?, ?, 1, ?, ?)`,
        ).run(id, config.enabled ? 1 : 0, JSON.stringify(config), now, now);
        addPrompt(id, config.systemPrompt, now);
      });
      return self.get(id)!;
    },

    // `version` is the one the screen was showing; a stale save is refused, not merged.
    update(id: string, config: AgentInput, version: number, now = Date.now()) {
      return tx(() => {
        const current = self.get(id);
        if (!current) return 'missing' as const;
        if (current.version !== version) return 'stale' as const;
        db.prepare(
          'UPDATE agents SET config = ?, enabled = ?, version = version + 1, updated_at = ? WHERE id = ?',
        ).run(JSON.stringify(config), config.enabled ? 1 : 0, now, id);
        if (current.config.systemPrompt !== config.systemPrompt)
          addPrompt(id, config.systemPrompt, now);
        return self.get(id)!;
      });
    },

    setEnabled(id: string, enabled: boolean, now = Date.now()) {
      return tx(() => {
        const current = self.get(id);
        if (!current) return null;
        const config = { ...current.config, enabled };
        db.prepare(
          'UPDATE agents SET config = ?, enabled = ?, version = version + 1, updated_at = ? WHERE id = ?',
        ).run(JSON.stringify(config), enabled ? 1 : 0, now, id);
        return self.get(id)!;
      });
    },

    // Soft delete: the row stays for the audit trail. Built-in agents can only be disabled.
    remove(id: string, now = Date.now()) {
      return tx(() => {
        const current = self.get(id);
        if (!current) return 'missing' as const;
        if (current.builtIn) return 'built_in' as const;
        if (self.list().some((a) => a.config.reportsTo === id))
          return 'has_reports' as const;
        db.prepare(
          'UPDATE agents SET deleted_at = ?, enabled = 0, updated_at = ? WHERE id = ?',
        ).run(now, now, id);
        return 'ok' as const;
      });
    },
  };
  return self;
}
export type Agents = ReturnType<typeof createAgents>;

// What the browser sees: the saved configuration plus the two statuses, worked out here.
export function viewOf(
  agent: ReturnType<Agents['list']>[number],
  catalog: Catalog,
  all: ReturnType<Agents['list']>,
  engine: { available: boolean },
): AgentView {
  const ids = all.map((a) => a.id);
  const reportsToOf = Object.fromEntries(
    all.map((a) => [a.id, a.config.reportsTo]),
  );
  const status = configStatus(agent.config, catalog, {
    selfId: agent.id,
    ids,
    reportsToOf,
  });
  const keyConfigured =
    catalog.providers.find((p) => p.id === agent.config.provider)
      ?.keyConfigured ?? false;
  return {
    id: agent.id,
    builtIn: agent.builtIn,
    version: agent.version,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    config: { ...agent.config, enabled: agent.enabled },
    configStatus: status.status,
    configIssues: status.issues,
    runtime: runtimeStatus(agent.enabled, engine, keyConfigured),
  };
}
