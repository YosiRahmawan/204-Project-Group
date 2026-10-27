import { expect, test } from 'vitest';
import { advance, createTask, decide, type Task } from './workflow';

const make = (instruction = 'Buat konten Instagram'): Task => {
  const result = createTask(instruction, 1, 0);
  if (!result.ok) throw new Error(result.error);
  return result.task;
};
const step = (task: Task, times = 1): Task => {
  let current = task;
  for (let i = 0; i < times; i++) {
    const result = advance(current, 1, i);
    if (!result.ok) throw new Error(result.error);
    current = result.task;
  }
  return current;
};

test('instruction goes through Akira and the owner to the CEO', () => {
  const task = step(make(), 4);
  expect(task.status).toBe('menunggu-approval');
  expect(task.owner).toBe('Aeri');
  expect(task.version).toBe(1);
  expect(task.history).toHaveLength(5);
});

test('rejects empty instructions and steps that do not exist', () => {
  expect(createTask('   ', 1, 0).ok).toBe(false);
  expect(advance(step(make(), 4), 1, 0).ok).toBe(false);
});

test('unmatched instructions rotate between agents', () => {
  expect(step(make('Sesuatu yang umum'), 2).owner).toBe('Amy');
});

test('approving needs the current result version and is idempotent', () => {
  const waiting = step(make(), 4);
  expect(decide(waiting, 'approve', 0, '', 9).ok).toBe(false);
  const approved = decide(waiting, 'approve', 1, '', 9);
  expect(approved.ok && approved.task.status).toBe('selesai');
  if (!approved.ok) return;
  const again = decide(approved.task, 'approve', 1, '', 10);
  expect(again.ok && again.task).toBe(approved.task);
  expect(decide(approved.task, 'reject', 1, '', 10).ok).toBe(false);
});

test('a revision needs a reason, and a new result voids the old approval', () => {
  const waiting = step(make(), 4);
  expect(decide(waiting, 'revise', 1, '  ', 5).ok).toBe(false);
  const revised = decide(waiting, 'revise', 1, 'Ganti nada visual', 5);
  if (!revised.ok) throw new Error(revised.error);
  expect(revised.task.status).toBe('revisi');
  const resubmitted = step(revised.task, 3);
  expect(resubmitted.status).toBe('menunggu-approval');
  expect(resubmitted.version).toBe(2);
  expect(decide(resubmitted, 'approve', 1, '', 6).ok).toBe(false);
  expect(decide(resubmitted, 'approve', 2, '', 6).ok).toBe(true);
});

test('only a task waiting for approval can be rejected', () => {
  expect(decide(make(), 'reject', 0, '', 1).ok).toBe(false);
  const rejected = decide(step(make(), 4), 'reject', 1, '', 2);
  expect(rejected.ok && rejected.task.status).toBe('ditolak');
});
