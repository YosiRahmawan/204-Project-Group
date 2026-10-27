import { expect, test } from 'vitest';
import { resolvePage, pages } from './navigation';

test('supports every declared deep link and falls back for unknown routes', () => {
  expect(pages).toHaveLength(8);
  for (const page of pages) {
    expect(resolvePage(`#/${page.id}`).id).toBe(page.id);
  }
  expect(resolvePage('').id).toBe('overview');
  expect(resolvePage('#/missing').id).toBe('overview');
});
