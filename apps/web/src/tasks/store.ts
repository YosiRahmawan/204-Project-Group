import { useSyncExternalStore } from 'react';
import type { Attachment, Decision, Task } from '@204/contracts';

// 'locked' = the server wants Leo's password; 'offline' = the server could not be reached.
type Phase = 'loading' | 'locked' | 'ready' | 'offline';
type State = { phase: Phase; tasks: Task[] };

let state: State = { phase: 'loading', tasks: [] };
let createKey = crypto.randomUUID();
let source: EventSource | null = null;
export type AuditEntry = {
  id: number;
  at: number;
  actor: string;
  action: string;
  detail: string;
};
const listeners = new Set<() => void>();
const publish = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export type Reply<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string> };

// Other stores (agents) re-read their data whenever the task list is refreshed.
export const refreshers = new Set<() => void>();

// Every call goes to the server; the header lets it tell a real click from a forged request.
export async function request<T>(
  method: string,
  path: string,
  options: { json?: unknown; raw?: Blob; name?: string; key?: string } = {},
): Promise<Reply<T>> {
  const headers: Record<string, string> = { 'x-requested-with': '204' };
  if (options.key) headers['idempotency-key'] = options.key;
  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.raw) {
    headers['content-type'] = 'application/octet-stream';
    headers['x-file-name'] = encodeURIComponent(options.name ?? 'file');
    body = options.raw;
  }
  try {
    const response = await fetch(`/api${path}`, {
      method,
      headers,
      ...(body ? { body } : {}),
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : null;
    if (response.status === 401 && path !== '/auth/login') {
      publish({ ...state, phase: 'locked' });
      return { ok: false, error: 'Masuk dulu.' };
    }
    if (!response.ok) {
      const body = data as {
        error?: string;
        fields?: Record<string, string>;
      } | null;
      return {
        ok: false,
        error: body?.error ?? 'Permintaan ditolak server.',
        ...(body?.fields ? { fields: body.fields } : {}),
      };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'Server tidak terjangkau.' };
  }
}

async function load() {
  const reply = await request<Task[]>('GET', '/tasks');
  if (reply.ok) {
    publish({ phase: 'ready', tasks: reply.data });
    refreshers.forEach((refresh) => refresh());
  } else if (state.phase !== 'locked') publish({ ...state, phase: 'offline' });
}

// Runs a change, then re-reads the list so the screen shows what the server now holds.
async function change(
  work: () => Promise<Reply<unknown>>,
): Promise<string | null> {
  const reply = await work();
  if (reply.ok) await load();
  return reply.ok ? null : reply.error;
}

// Opens the live stream once; the browser reconnects by itself, and every (re)connection
// reloads the list in case something changed meanwhile.
function connect() {
  if (source && source.readyState !== EventSource.CLOSED) return;
  source = new EventSource('/api/events');
  source.addEventListener('changed', () => void load());
  source.onopen = () => void load();
  source.onerror = () => {
    if (source?.readyState === EventSource.CLOSED) source = null;
  };
}

// Each action returns an error message, or null on success.
export const actions = {
  // Loads now, then keeps the list fresh: the server announces every change on an event stream.
  start() {
    void load();
    connect();
    const visible = () => {
      if (document.visibilityState === 'visible' && state.phase !== 'locked')
        void load();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      source?.close();
      source = null;
      document.removeEventListener('visibilitychange', visible);
    };
  },
  async login(password: string): Promise<string | null> {
    const reply = await request('POST', '/auth/login', { json: { password } });
    if (!reply.ok) return reply.error;
    await load();
    connect();
    return null;
  },
  async logout() {
    await request('POST', '/auth/logout');
    source?.close();
    source = null;
    publish({ phase: 'locked', tasks: [] });
  },
  async upload(
    file: File,
  ): Promise<{ attachment: Attachment } | { error: string }> {
    const reply = await request<Attachment>('POST', '/files', {
      raw: file,
      name: file.name,
    });
    return reply.ok
      ? { attachment: reply.data }
      : { error: `${file.name}: ${reply.error}` };
  },
  // One key per attempt: a double submit or a retry gets the first answer, not a second task.
  async create(instruction: string, attachments: Attachment[] = []) {
    const problem = await change(() =>
      request('POST', '/tasks', {
        key: createKey,
        json: { instruction, fileIds: attachments.map((a) => a.id) },
      }),
    );
    if (!problem) createKey = crypto.randomUUID();
    return problem;
  },
  // `from` is the stage on screen, so a second click on the same button is refused.
  advance: (number: number, from: string) =>
    change(() =>
      request('POST', `/tasks/${number}/advance`, { json: { from } }),
    ),
  decide: (number: number, decision: Decision, version: number, reason = '') =>
    change(() =>
      request('POST', `/tasks/${number}/decision`, {
        json: { decision, version, reason },
      }),
    ),
  async audit(): Promise<AuditEntry[]> {
    const reply = await request<AuditEntry[]>('GET', '/audit?limit=200');
    return reply.ok ? reply.data : [];
  },
  // Sample data and a reset, so the statistics can be tried out and cleared again.
  seed: () => change(() => request('POST', '/tasks/demo')),
  clear: () => change(() => request('DELETE', '/tasks')),
};

const useSelect = <T>(pick: (s: State) => T) =>
  useSyncExternalStore(
    subscribe,
    () => pick(state),
    () => pick(state),
  );
export const useTasks = () => useSelect((s) => s.tasks);
export const usePhase = () => useSelect((s) => s.phase);
