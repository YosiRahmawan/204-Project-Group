import { useSyncExternalStore } from 'react';
import {
  advance,
  createTask,
  decide,
  type Decision,
  type Result,
  type Task,
} from './workflow';

let tasks: Task[] = [];
const listeners = new Set<() => void>();
const publish = (next: Task[]) => {
  tasks = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function update(id: string, change: (task: Task) => Result) {
  const current = tasks.find((task) => task.id === id);
  if (!current) return 'Task tidak ditemukan.';
  const result = change(current);
  if (!result.ok) return result.error;
  publish(tasks.map((task) => (task.id === id ? result.task : task)));
  return null;
}

// Each action returns an error message, or null on success.
export const actions = {
  create(instruction: string): string | null {
    const result = createTask(instruction, tasks.length + 1, Date.now());
    if (!result.ok) return result.error;
    publish([...tasks, result.task]);
    return null;
  },
  advance(id: string): string | null {
    return update(id, (task) => advance(task, tasks.length, Date.now()));
  },
  decide(
    id: string,
    decision: Decision,
    version: number,
    reason = '',
  ): string | null {
    return update(id, (task) =>
      decide(task, decision, version, reason, Date.now()),
    );
  },
};

export const useTasks = () =>
  useSyncExternalStore(
    subscribe,
    () => tasks,
    () => tasks,
  );
