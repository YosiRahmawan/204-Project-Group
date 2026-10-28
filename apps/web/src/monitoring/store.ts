import { useSyncExternalStore } from 'react';
import { refreshers, request } from '../tasks/store';

export type HermesStatus = {
  configured: boolean;
  connected: boolean;
  model: string | null;
  toolsEnabled: string[];
  safe: boolean;
  checkedAt: number;
  reason: string;
  running: boolean;
};
export type AkiraRun = {
  id: string;
  instruction: string;
  status: 'running' | 'completed' | 'failed';
  answer: string | null;
  error: string | null;
  model: string | null;
  tokens: { prompt: number; completion: number; total: number } | null;
  costUsd: number | null;
  durationMs: number | null;
  createdAt: number;
};

type State = {
  loaded: boolean;
  error: string;
  hermes: HermesStatus | null;
  runs: AkiraRun[];
};
let state: State = { loaded: false, error: '', hermes: null, runs: [] };
const listeners = new Set<() => void>();
const publish = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
};

async function load() {
  const [hermes, runs] = await Promise.all([
    request<HermesStatus>('GET', '/hermes/status'),
    request<{ runs: AkiraRun[] }>('GET', '/akira/runs?limit=30'),
  ]);
  if (hermes.ok && runs.ok)
    publish({
      loaded: true,
      error: '',
      hermes: hermes.data,
      runs: runs.data.runs,
    });
  else if (!state.loaded)
    publish({
      ...state,
      error: hermes.ok ? 'Riwayat gagal dimuat.' : hermes.error,
    });
}

export const monitoringActions = {
  load,
  // Waits for Akira's answer (it can take a while); resolves to an error message or null.
  async ask(instruction: string) {
    const reply = await request<unknown>('POST', '/akira/ask', {
      json: { instruction },
    });
    await load();
    return reply.ok ? null : reply.error;
  },
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
export const useMonitoring = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
