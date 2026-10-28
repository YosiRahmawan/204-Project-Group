import { useSyncExternalStore } from 'react';
import { refreshers, request } from '../tasks/store';

export type MemoryStatus =
  | { configured: false; message: string; pendingProposals: number }
  | {
      configured: true;
      vault: string;
      notes: number;
      pendingProposals: number;
      learning: { automatic: boolean; note: string };
    };
export type Proposal = {
  id: string;
  agent: string;
  path: string;
  content: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  decidedAt: number | null;
  stale: boolean;
};
export type NoteInfo = { path: string; size: number; modified: number };

type State = {
  loaded: boolean;
  error: string;
  status: MemoryStatus | null;
  proposals: Proposal[];
  notes: NoteInfo[];
};
let state: State = {
  loaded: false,
  error: '',
  status: null,
  proposals: [],
  notes: [],
};
const listeners = new Set<() => void>();
const publish = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
};

async function load() {
  const status = await request<MemoryStatus>('GET', '/memory/status');
  if (!status.ok) {
    if (!state.loaded) publish({ ...state, error: status.error });
    return;
  }
  // Without a vault there is nothing more to read; the proposals and tree routes would refuse.
  if (!status.data.configured) {
    publish({ ...state, loaded: true, error: '', status: status.data });
    return;
  }
  const [proposals, tree] = await Promise.all([
    request<{ proposals: Proposal[] }>('GET', '/memory/proposals'),
    request<{ notes: NoteInfo[] }>('GET', '/memory/tree'),
  ]);
  publish({
    loaded: true,
    error: proposals.ok && tree.ok ? '' : 'Sebagian data memori gagal dimuat.',
    status: status.data,
    proposals: proposals.ok ? proposals.data.proposals : state.proposals,
    notes: tree.ok ? tree.data.notes : state.notes,
  });
}

// Each action resolves to an error message, or null when the server accepted it.
const run = async (work: () => ReturnType<typeof request<unknown>>) => {
  const reply = await work();
  if (reply.ok) await load();
  return reply.ok ? null : reply.error;
};

export const memoryActions = {
  load,
  init: () => run(() => request('POST', '/memory/init')),
  decide: (id: string, decision: 'approve' | 'reject') =>
    run(() =>
      request('POST', `/memory/proposals/${id}/decision`, {
        json: { decision },
      }),
    ),
  read: async (path: string) => {
    const reply = await request<{ content: string; hash: string }>(
      'GET',
      `/memory/note?as=leo&path=${encodeURIComponent(path)}`,
    );
    return reply.ok ? reply.data : { error: reply.error };
  },
  write: (path: string, content: string, expectedHash: string | null) =>
    run(() =>
      request('PUT', '/memory/note', {
        json: { as: 'leo', path, content, expectedHash },
      }),
    ),
};

let started = false;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    refreshers.add(() => void load());
    void load();
  }
  return () => listeners.delete(listener);
}
export const useMemory = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
