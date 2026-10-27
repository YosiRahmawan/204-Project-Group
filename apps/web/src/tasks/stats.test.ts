import { expect, test } from 'vitest';
import { summarize } from './stats';
import { demoTasks } from './demo';

test('an empty board has zero everything and no approval rate', () => {
  const s = summarize([]);
  expect(s.total).toBe(0);
  expect(s.approvalRate).toBeNull();
  expect(Object.values(s.byStatus).every((n) => n === 0)).toBe(true);
});

test('counts statuses, owners, revisions and the approval rate', () => {
  const tasks = demoTasks(0);
  const s = summarize(tasks);
  expect(s.total).toBe(tasks.length);
  expect(Object.values(s.byStatus).reduce((a, b) => a + b, 0)).toBe(
    tasks.length,
  );
  expect(s.approved).toBe(2);
  expect(s.rejected).toBe(1);
  expect(s.approvalRate).toBeCloseTo(2 / 3);
  expect(s.active).toBe(tasks.length - 3);
  // One demo task was sent back once before it was approved.
  expect(s.revisions).toBe(1);
  expect(Object.values(s.byOwner).reduce((a, b) => a + b, 0)).toBe(
    tasks.filter((t) => t.owner).length,
  );
});
