import { useSyncExternalStore } from 'react';
import type { AgentInput, AgentView, AgentsMeta } from '@204/contracts';
import { refreshers, request } from '../tasks/store';

type State = {
  status: 'loading' | 'ready' | 'error';
  agents: AgentView[];
  meta: AgentsMeta | null;
  error: string;
};
let state: State = { status: 'loading', agents: [], meta: null, error: '' };
const listeners = new Set<() => void>();
const publish = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
};

async function load() {
  const reply = await request<{ agents: AgentView[]; meta: AgentsMeta }>(
    'GET',
    '/agents',
  );
  if (reply.ok) publish({ status: 'ready', error: '', ...reply.data });
  else if (state.status !== 'ready')
    publish({ ...state, status: 'error', error: reply.error });
}

// Tells the form what went wrong; `fields` names the inputs the server refused.
export type Outcome = { error: string; fields: Record<string, string> } | null;
async function run(
  work: () => ReturnType<typeof request<unknown>>,
): Promise<Outcome> {
  const reply = await work();
  if (reply.ok) {
    await load();
    return null;
  }
  return { error: reply.error, fields: reply.fields ?? {} };
}

export const agentActions = {
  load,
  create: (config: AgentInput) =>
    run(() => request('POST', '/agents', { json: { config } })),
  save: (id: string, version: number, config: AgentInput) =>
    run(() => request('PUT', `/agents/${id}`, { json: { version, config } })),
  setEnabled: (id: string, enabled: boolean) =>
    run(() => request('PATCH', `/agents/${id}/enabled`, { json: { enabled } })),
  resetPrompt: (id: string) =>
    run(() => request('POST', `/agents/${id}/prompt/reset`)),
  remove: (id: string) => run(() => request('DELETE', `/agents/${id}`)),
  history: async (id: string) => {
    const reply = await request<{
      promptHistory: { at: number; prompt: string }[];
    }>('GET', `/agents/${id}`);
    return reply.ok ? reply.data.promptHistory : [];
  },
};

// Reads happen once the first screen asks for them, and again whenever the task list refreshes
// (which the server's change stream triggers), so edits in another tab show up here.
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
export const useAgents = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
