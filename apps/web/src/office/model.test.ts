import { expect, test } from 'vitest';
import { findPath, toScreen, toGrid, isWalkable, desks } from './model';

test('isometric picking returns the original floor cell', () => {
  for (let x = 0; x < 12; x++)
    for (let y = 0; y < 10; y++) {
      expect(toGrid(toScreen({ x, y }))).toEqual({ x, y });
    }
});

test('routes go around furniture using adjacent walkable cells', () => {
  const start = { x: 10, y: 13 };
  const goal = { x: 20, y: 13 };
  const path = findPath(start, goal);
  expect(path.at(-1)).toEqual(goal);
  expect(path.length).toBeGreaterThan(10);
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
  const start = { x: 14, y: 27 };
  expect(findPath(start, desks[0]!)).toEqual([]);
  expect(findPath(start, { x: -1, y: 0 })).toEqual([]);
  expect(findPath(start, { x: 30, y: 0 })).toEqual([]);
  expect(findPath(start, { x: NaN, y: 0 })).toEqual([]);
  expect(findPath(start, start)).toEqual([]);
  expect(findPath(start, { x: 15, y: 27 }, () => false)).toEqual([]);
  expect(findPath({ x: 0, y: 0 }, start)).toEqual([]);
  expect(findPath(start, { x: 16, y: 27 }, (cell) => cell.x !== 15)).toEqual(
    [],
  );
  expect(findPath(start, { x: 16, y: 27 })).toEqual([
    { x: 15, y: 27 },
    { x: 16, y: 27 },
  ]);
});
