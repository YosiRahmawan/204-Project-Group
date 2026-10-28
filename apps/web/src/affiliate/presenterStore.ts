import { useSyncExternalStore } from 'react';
import { refreshers, request } from '../tasks/store';

export type Presenter = {
  id: string;
  name: string;
  style: string;
  notes: string;
  consentAt: number;
  photos: {
    id: string;
    name: string;
    mime: string;
    bytes: number;
    width: number | null;
    height: number | null;
  }[];
};
type State = { loaded: boolean; presenters: Presenter[] };
let state: State = { loaded: false, presenters: [] };
const listeners = new Set<() => void>();
const publish = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
};

async function load() {
  const reply = await request<{ presenters: Presenter[] }>(
    'GET',
    '/presenters',
  );
  if (reply.ok) publish({ loaded: true, presenters: reply.data.presenters });
}
const run = async (work: () => ReturnType<typeof request<unknown>>) => {
  const reply = await work();
  if (reply.ok) await load();
  return reply.ok ? null : reply.error;
};

export const presenterActions = {
  load,
  create: (input: {
    name: string;
    style: string;
    notes: string;
    consent: boolean;
  }) => run(() => request('POST', '/presenters', { json: input })),
  update: (id: string, input: { name: string; style: string; notes: string }) =>
    run(() => request('PUT', `/presenters/${id}`, { json: input })),
  remove: (id: string) => run(() => request('DELETE', `/presenters/${id}`)),
  addPhoto: (id: string, file: File) =>
    run(() =>
      request('POST', `/presenters/${id}/photos`, {
        raw: file,
        name: file.name,
      }),
    ),
  removePhoto: (id: string, photoId: string) =>
    run(() => request('DELETE', `/presenters/${id}/photos/${photoId}`)),
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
export const usePresenters = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
