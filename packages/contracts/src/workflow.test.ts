import { expect, test } from 'vitest';
import { advance, createTask, decide, type Task } from './workflow.js';

const make = (instruction = 'Buat konten Instagram'): Task => {
  const result = createTask(instruction, 1, 0);
  if (!result.ok) throw new Error(result.error);
  return result.task;
};
const step = (task: Task, times = 1): Task => {
  let current = task;
  for (let i = 0; i < times; i++) {
    const result = advance(current, i);
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
  const file = { id: 'f1', name: 'a.png', size: 1, type: 'image/png' };
  expect(createTask('', 1, 0, [file]).ok).toBe(true);
  expect(advance(step(make(), 4), 0).ok).toBe(false);
});

test('unmatched instructions rotate by the task number, not by when they are advanced', () => {
  const owner = (number: number) => {
    const created = createTask('Sesuatu yang umum', number, 0);
    if (!created.ok) throw new Error(created.error);
    return step(created.task, 2).owner;
  };
  expect(owner(1)).toBe('Amy');
  expect(owner(4)).toBe('Zegion');
  expect(owner(6)).toBe('Amy');
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

test('history marks sent-back and rejected work as warnings and approvals as done', () => {
  const waiting = step(make(), 4);
  const revised = decide(waiting, 'revise', 1, 'Ubah', 1);
  const approved = decide(waiting, 'approve', 1, '', 1);
  const rejected = decide(waiting, 'reject', 1, '', 1);
  const kind = (r: ReturnType<typeof decide>) =>
    r.ok && r.task.history.at(-1)?.kind;
  expect(kind(revised)).toBe('warn');
  expect(kind(approved)).toBe('done');
  expect(kind(rejected)).toBe('warn');
  expect(waiting.history.at(-1)?.kind).toBe('info');
});
