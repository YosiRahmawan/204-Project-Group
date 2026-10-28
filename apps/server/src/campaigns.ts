import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { CampaignInput, CampaignView } from '@204/contracts';

export const campaignSchema = `
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft',
  ai_draft INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
`;

type Row = Record<string, string | number | null>;
const toView = (r: Row): CampaignView => ({
  id: String(r.id),
  status: r.status === 'approved' ? 'approved' : 'draft',
  version: Number(r.version),
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
  aiDraft: r.ai_draft === 1,
  config: JSON.parse(String(r.config)) as CampaignInput,
});

export function createCampaigns(db: DatabaseSync) {
  const get = (id: string) => {
    const row = db
      .prepare('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL')
      .get(id) as Row | undefined;
    return row ? toView(row) : null;
  };
  // `version` is what the screen was showing; a stale write is refused instead of overwriting.
  const write = (
    id: string,
    version: number,
    change: { config?: CampaignInput; status?: string; aiDraft?: boolean },
  ) => {
    const current = get(id);
    if (!current) return 'missing' as const;
    if (current.version !== version) return 'stale' as const;
    db.prepare(
      'UPDATE campaigns SET config = ?, status = ?, ai_draft = ?, version = version + 1, updated_at = ? WHERE id = ?',
    ).run(
      JSON.stringify(change.config ?? current.config),
      change.status ?? current.status,
      (change.aiDraft ?? current.aiDraft) ? 1 : 0,
      Date.now(),
      id,
    );
    return get(id)!;
  };
  return {
    list: () =>
      (
        db
          .prepare(
            'SELECT * FROM campaigns WHERE deleted_at IS NULL ORDER BY updated_at DESC, id',
          )
          .all() as Row[]
      ).map(toView),
    get,
    create(config: CampaignInput) {
      const id = randomUUID();
      const now = Date.now();
      db.prepare(
        'INSERT INTO campaigns (id, config, created_at, updated_at) VALUES (?, ?, ?, ?)',
      ).run(id, JSON.stringify(config), now, now);
      return get(id)!;
    },
    // Editing by hand means Leo has reviewed the text, and any earlier approval no longer holds.
    update: (id: string, version: number, config: CampaignInput) =>
      write(id, version, { config, status: 'draft', aiDraft: false }),
    applyAiDraft: (id: string, version: number, config: CampaignInput) =>
      write(id, version, { config, status: 'draft', aiDraft: true }),
    approve: (id: string, version: number) =>
      write(id, version, { status: 'approved', aiDraft: false }),
    remove(id: string) {
      const done = db
        .prepare(
          'UPDATE campaigns SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
        )
        .run(Date.now(), id);
      return done.changes > 0;
    },
  };
}
export type Campaigns = ReturnType<typeof createCampaigns>;
