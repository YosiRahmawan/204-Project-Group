import { useSyncExternalStore } from 'react';
import type { CampaignInput, CampaignView, GenerateKind } from '@204/contracts';
import { refreshers, request } from '../tasks/store';

type State = {
  status: 'loading' | 'ready' | 'error';
  campaigns: CampaignView[];
  error: string;
};
let state: State = { status: 'loading', campaigns: [], error: '' };
const listeners = new Set<() => void>();
const publish = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
};

async function load() {
  const reply = await request<{ campaigns: CampaignView[] }>(
    'GET',
    '/campaigns',
  );
  if (reply.ok)
    publish({ status: 'ready', error: '', campaigns: reply.data.campaigns });
  else if (state.status !== 'ready')
    publish({ ...state, status: 'error', error: reply.error });
}

// Every change returns the saved campaign (or the server's reason), and refreshes the list.
export type Outcome =
  | { campaign: CampaignView | null }
  | { error: string; fields: Record<string, string> };
async function run(
  work: () => Promise<
    Awaited<ReturnType<typeof request<{ campaign?: CampaignView }>>>
  >,
): Promise<Outcome> {
  const reply = await work();
  if (!reply.ok) return { error: reply.error, fields: reply.fields ?? {} };
  await load();
  return { campaign: reply.data?.campaign ?? null };
}

export const campaignActions = {
  load,
  create: (config: CampaignInput) =>
    run(() => request('POST', '/campaigns', { json: { config } })),
  save: (id: string, version: number, config: CampaignInput) =>
    run(() =>
      request('PUT', `/campaigns/${id}`, { json: { version, config } }),
    ),
  approve: (id: string, version: number) =>
    run(() =>
      request('POST', `/campaigns/${id}/approve`, { json: { version } }),
    ),
  generate: (id: string, version: number, kind: GenerateKind) =>
    run(() =>
      request('POST', `/campaigns/${id}/generate`, {
        json: { version, kind, approvePaid: true },
      }),
    ),
  remove: (id: string) => run(() => request('DELETE', `/campaigns/${id}`)),
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
export const useCampaigns = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
