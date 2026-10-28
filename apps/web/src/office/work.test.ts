import { expect, test } from 'vitest';
import { workOf } from './work';
import { demoTasks } from '@204/contracts';

test('an empty office has everyone waiting', () => {
  for (const name of ['Leo', 'Akira', 'Aeri', 'Zegion'])
    expect(workOf(name, []).state).toBe('idle');
});

test('agents show the task they own, Akira the one she is routing, Leo the approvals', () => {
  const tasks = demoTasks(0);
  // Demo T-004 (budget, owner Mail) is being worked on; T-006 (logo, Kuro) waits for Leo.
  expect(workOf('Mail', tasks)).toEqual({
    text: 'Mengerjakan T-004 Susun anggaran kuartal empat',
    state: 'working',
  });
  expect(workOf('Kuro', tasks).state).toBe('idle');
  expect(workOf('Leo', tasks)).toEqual({
    text: '1 hasil menunggu keputusan',
    state: 'waiting',
  });
  expect(workOf('Akira', tasks).text).toMatch(
    /^(Meninjau|Menganalisis|Menerima) T-00/,
  );
});
