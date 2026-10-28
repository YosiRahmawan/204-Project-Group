import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  Agent,
  Attachment,
  HistoryKind,
  Result,
  Status,
  Task,
} from '@204/contracts';
import { agentSchema } from './agents.js';

const schema = `
CREATE TABLE IF NOT EXISTS tasks (
  number INTEGER PRIMARY KEY,
  instruction TEXT NOT NULL,
  status TEXT NOT NULL,
  owner TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  revision_reason TEXT
);
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_number INTEGER NOT NULL REFERENCES tasks(number) ON DELETE CASCADE,
  at INTEGER NOT NULL,
  text TEXT NOT NULL,
  kind TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  type TEXT NOT NULL,
  task_number INTEGER REFERENCES tasks(number) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
-- Append-only: nothing in the app deletes from this table.
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
-- Only a hash of each session token is kept, so a copy of the database cannot be used to log in.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
-- Answers already given to a request that carried an idempotency key.
CREATE TABLE IF NOT EXISTS replies (
  key TEXT PRIMARY KEY,
  status INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

export type AuditEntry = {
  id: number;
  at: number;
  actor: string;
  action: string;
  detail: string;
};

type Row = Record<string, string | number | null>;

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(schema);
  db.exec(agentSchema);
  return db;
}

// All reads and writes of tasks and files. The database API is synchronous, so each
// transaction below runs to the end before anything else touches the data.
export function createStore(db: DatabaseSync) {
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

  const toAttachment = (r: Row): Attachment => ({
    id: String(r.id),
    name: String(r.name),
    size: Number(r.size),
    type: String(r.type),
  });
  const toTask = (
    r: Row,
    history: Task['history'],
    attachments: Attachment[],
  ): Task => ({
    number: Number(r.number),
    id: `T-${String(r.number).padStart(3, '0')}`,
    instruction: String(r.instruction),
    status: r.status as Status,
    owner: (r.owner as Agent | null) ?? null,
    version: Number(r.version),
    revisionReason: (r.revision_reason as string | null) ?? null,
    attachments,
    history,
  });

  const taskRows = db.prepare('SELECT * FROM tasks ORDER BY number');
  const taskRow = db.prepare('SELECT * FROM tasks WHERE number = ?');
  const historyAll = db.prepare('SELECT * FROM history ORDER BY id');
  const historyOne = db.prepare(
    'SELECT * FROM history WHERE task_number = ? ORDER BY id',
  );
  const filesAll = db.prepare(
    'SELECT * FROM files WHERE task_number IS NOT NULL ORDER BY created_at, id',
  );
  const filesOne = db.prepare(
    'SELECT * FROM files WHERE task_number = ? ORDER BY created_at, id',
  );
  const nextNumber = db.prepare(
    'SELECT COALESCE(MAX(number), 0) + 1 AS next FROM tasks',
  );
  const insertTask = db.prepare(
    'INSERT INTO tasks (number, instruction, status, owner, version, revision_reason) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const updateTask = db.prepare(
    'UPDATE tasks SET status = ?, owner = ?, version = ?, revision_reason = ? WHERE number = ?',
  );
  const insertHistory = db.prepare(
    'INSERT INTO history (task_number, at, text, kind) VALUES (?, ?, ?, ?)',
  );
  const claimFile = db.prepare(
    'UPDATE files SET task_number = ? WHERE id = ? AND task_number IS NULL',
  );
  const fileById = db.prepare('SELECT * FROM files WHERE id = ?');

  const history = (r: Row) => ({
    at: Number(r.at),
    text: String(r.text),
    kind: r.kind as HistoryKind,
  });

  function readOne(number: number): Task | null {
    const row = taskRow.get(number) as Row | undefined;
    if (!row) return null;
    return toTask(
      row,
      (historyOne.all(number) as Row[]).map(history),
      (filesOne.all(number) as Row[]).map(toAttachment),
    );
  }

  // Writes a task that already exists in memory: its row, and only the new history lines.
  function write(task: Task, known: number) {
    updateTask.run(
      task.status,
      task.owner,
      task.version,
      task.revisionReason,
      task.number,
    );
    for (const h of task.history.slice(known))
      insertHistory.run(task.number, h.at, h.text, h.kind);
  }

  return {
    // Three queries however many tasks there are.
    list(): Task[] {
      const byTask = <T>(rows: Row[], map: (r: Row) => T) => {
        const groups = new Map<number, T[]>();
        for (const r of rows) {
          const key = Number(r.task_number);
          groups.set(key, [...(groups.get(key) ?? []), map(r)]);
        }
        return groups;
      };
      const histories = byTask(historyAll.all() as Row[], history);
      const files = byTask(filesAll.all() as Row[], toAttachment);
      return (taskRows.all() as Row[]).map((r) =>
        toTask(
          r,
          histories.get(Number(r.number)) ?? [],
          files.get(Number(r.number)) ?? [],
        ),
      );
    },

    get: readOne,

    // `build` receives the next number and the attached files, and returns the new task
    // or an error.
    // Files are claimed for the task in the same transaction; a missing or already used
    // file cancels everything.
    insert(
      build: (number: number, files: Attachment[]) => Result,
      fileIds: string[],
    ): Result {
      return tx(() => {
        const number = Number((nextNumber.get() as Row).next);
        const missing = fileIds.some(
          (id) => (fileById.get(id) as Row | undefined)?.task_number !== null,
        );
        if (missing)
          return {
            ok: false,
            error: 'Lampiran tidak ditemukan atau sudah dipakai.',
          };
        const files = fileIds.map((id) =>
          toAttachment(fileById.get(id) as Row),
        );
        const result = build(number, files);
        if (!result.ok) return result;
        const task = result.task;
        insertTask.run(
          task.number,
          task.instruction,
          task.status,
          task.owner,
          task.version,
          task.revisionReason,
        );
        write(task, 0);
        for (const id of fileIds) claimFile.run(task.number, id);
        return { ok: true, task };
      });
    },

    // Applies a workflow step to one task, or returns null when it does not exist.
    update(number: number, change: (task: Task) => Result): Result | null {
      return tx(() => {
        const task = readOne(number);
        if (!task) return null;
        const result = change(task);
        if (result.ok) write(result.task, task.history.length);
        return result;
      });
    },

    // Adds ready-made tasks (the sample data) after the existing ones.
    insertMany(make: (firstNumber: number) => Task[]): number {
      return tx(() => {
        const tasks = make(Number((nextNumber.get() as Row).next));
        for (const task of tasks) {
          insertTask.run(
            task.number,
            task.instruction,
            task.status,
            task.owner,
            task.version,
            task.revisionReason,
          );
          write(task, 0);
        }
        return tasks.length;
      });
    },

    clear() {
      tx(() => {
        db.exec('DELETE FROM tasks');
      });
    },

    addFile(file: Attachment) {
      db.prepare(
        'INSERT INTO files (id, name, size, type, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(file.id, file.name, file.size, file.type, Date.now());
    },

    file(id: string): Attachment | null {
      const row = fileById.get(id) as Row | undefined;
      return row ? toAttachment(row) : null;
    },

    audit(actor: string, action: string, detail = '') {
      db.prepare(
        'INSERT INTO audit (at, actor, action, detail) VALUES (?, ?, ?, ?)',
      ).run(Date.now(), actor, action, detail);
    },
    auditList(limit: number): AuditEntry[] {
      return (
        db
          .prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ?')
          .all(limit) as Row[]
      ).map((r) => ({
        id: Number(r.id),
        at: Number(r.at),
        actor: String(r.actor),
        action: String(r.action),
        detail: String(r.detail),
      }));
    },

    sessions: {
      put(hash: string, expiresAt: number) {
        db.prepare(
          'INSERT OR REPLACE INTO sessions (token_hash, expires_at) VALUES (?, ?)',
        ).run(hash, expiresAt);
      },
      expiry(hash: string): number | undefined {
        const row = db
          .prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
          .get(hash) as Row | undefined;
        return row ? Number(row.expires_at) : undefined;
      },
      remove(hash: string) {
        db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
      },
      purge(now: number) {
        db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
      },
    },

    // A repeated request with the same key gets the first answer instead of running again.
    replies: {
      get(key: string): { status: number; body: string } | null {
        const row = db
          .prepare('SELECT status, body FROM replies WHERE key = ?')
          .get(key) as Row | undefined;
        return row
          ? { status: Number(row.status), body: String(row.body) }
          : null;
      },
      put(key: string, status: number, body: string) {
        db.prepare(
          'INSERT OR IGNORE INTO replies (key, status, body, created_at) VALUES (?, ?, ?, ?)',
        ).run(key, status, body, Date.now());
      },
      purge(olderThan: number) {
        db.prepare('DELETE FROM replies WHERE created_at < ?').run(olderThan);
      },
    },

    // Files that were uploaded but never attached to a task.
    purgeOrphans(olderThan: number): string[] {
      const rows = db
        .prepare(
          'SELECT id FROM files WHERE task_number IS NULL AND created_at < ?',
        )
        .all(olderThan) as Row[];
      db.prepare(
        'DELETE FROM files WHERE task_number IS NULL AND created_at < ?',
      ).run(olderThan);
      return rows.map((r) => String(r.id));
    },
  };
}
export type Store = ReturnType<typeof createStore>;
