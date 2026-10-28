import { useSyncExternalStore } from 'react';
import type { Attachment, Decision, Task } from '@204/contracts';

// 'locked' = the server wants Leo's password; 'offline' = the server could not be reached.
type Phase = 'loading' | 'locked' | 'ready' | 'offline';
type State = { phase: Phase; tasks: Task[] };

let state: State = { phase: 'loading', tasks: [] };
const listeners = new Set<() => void>();
const publish = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

// Every call goes to the server; the header lets it tell a real click from a forged request.
async function request<T>(
  method: string,
  path: string,
  options: { json?: unknown; raw?: Blob; name?: string } = {},
): Promise<Reply<T>> {
  const headers: Record<string, string> = { 'x-requested-with': '204' };
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
      const message = (data as { error?: string } | null)?.error;
      return { ok: false, error: message ?? 'Permintaan ditolak server.' };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'Server tidak terjangkau.' };
  }
}

async function load() {
  const reply = await request<Task[]>('GET', '/tasks');
  if (reply.ok) publish({ phase: 'ready', tasks: reply.data });
  else if (state.phase !== 'locked') publish({ ...state, phase: 'offline' });
}

// Runs a change, then re-reads the list so the screen shows what the server now holds.
async function change(
  work: () => Promise<Reply<unknown>>,
): Promise<string | null> {
  const reply = await work();
  if (reply.ok) await load();
  return reply.ok ? null : reply.error;
}

// Each action returns an error message, or null on success.
export const actions = {
  // Loads now and keeps the list fresh while the tab is visible.
  start() {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && state.phase !== 'locked')
        void load();
    }, 15_000);
    return () => window.clearInterval(timer);
  },
  async login(password: string): Promise<string | null> {
    const reply = await request('POST', '/auth/login', { json: { password } });
    if (!reply.ok) return reply.error;
    await load();
    return null;
  },
  async logout() {
    await request('POST', '/auth/logout');
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
  create: (instruction: string, attachments: Attachment[] = []) =>
    change(() =>
      request('POST', '/tasks', {
        json: { instruction, fileIds: attachments.map((a) => a.id) },
      }),
    ),
  advance: (number: number) =>
    change(() => request('POST', `/tasks/${number}/advance`)),
  decide: (number: number, decision: Decision, version: number, reason = '') =>
    change(() =>
      request('POST', `/tasks/${number}/decision`, {
        json: { decision, version, reason },
      }),
    ),
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
