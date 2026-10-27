import { expect, test } from 'vitest';
import { findPath, isWalkable } from './model';

test('routes go around furniture using adjacent walkable cells', () => {
  // Left and right desk clusters of the Main Workspace, 16 px cells.
  const start = { x: 36, y: 31 };
  const goal = { x: 59, y: 31 };
  const path = findPath(start, goal);
  expect(path.at(-1)).toEqual(goal);
  let previous = start;
  for (const cell of path) {
    expect(isWalkable(cell)).toBe(true);
    expect(Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y)).toBe(
      1,
    );
    previous = cell;
  }
});

test('rejects occupied and invalid cells without producing a route', () => {
  const start = { x: 47, y: 53 };
  expect(findPath(start, { x: 47, y: 48 })).toEqual([]); // reception desk
  expect(findPath(start, { x: -1, y: 0 })).toEqual([]);
  expect(findPath(start, { x: 96, y: 0 })).toEqual([]);
  expect(findPath(start, { x: NaN, y: 0 })).toEqual([]);
  expect(findPath(start, start)).toEqual([]);
  expect(findPath(start, { x: 48, y: 53 }, () => false)).toEqual([]);
  expect(findPath(start, { x: 49, y: 53 })).toEqual([
    { x: 48, y: 53 },
    { x: 49, y: 53 },
  ]);
});
