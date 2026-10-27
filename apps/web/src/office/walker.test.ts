import { expect, test } from 'vitest';
import {
  advance,
  goTo,
  heading,
  newWalker,
  snapToGoal,
  walkerPoint,
} from './walker';
import { isWalkable, type Cell } from './model';
import { spawn } from './layout';

const run = (w: ReturnType<typeof newWalker>, frames: number) => {
  let arrived = 0;
  for (let i = 0; i < frames; i++) if (advance(w, 50) === 'arrived') arrived++;
  return arrived;
};

test('walks a route one cell per step and reports arrival once', () => {
  const w = newWalker(spawn);
  const goal = { x: spawn.x + 3, y: spawn.y };
  expect(goTo(w, goal)).toBe('started');
  expect(heading(w)).toBe('right');
  expect(advance(w, 50)).toBe('moving');
  expect(walkerPoint(w).x).toBeGreaterThan(spawn.x * 16 + 8);
  expect(run(w, 20)).toBe(1);
  expect(w.cell).toEqual(goal);
  expect(advance(w, 50)).toBe('idle');
});

test('a goal given mid-step is queued and replanned at the next cell', () => {
  const w = newWalker(spawn);
  goTo(w, { x: spawn.x + 6, y: spawn.y });
  advance(w, 20);
  const newGoal = { x: spawn.x - 2, y: spawn.y };
  expect(goTo(w, newGoal)).toBe('queued');
  expect(run(w, 40)).toBe(1);
  expect(w.cell).toEqual(newGoal);
});

test('rejects blocked goals and unreachable goals without moving', () => {
  const w = newWalker(spawn);
  expect(goTo(w, { x: 47, y: 48 })).toBe('blocked');
  expect(goTo(w, spawn)).toBe('here');
  const goal = { x: spawn.x + 3, y: spawn.y };
  expect(goTo(w, goal, (c: Cell) => c.x !== goal.x)).toBe('blocked');
  expect(goTo(w, goal, (c: Cell) => c.x < spawn.x + 2 || c === goal)).toBe(
    'unreachable',
  );
  expect(w.route).toEqual([]);
});

test('a long frame advances at most one step', () => {
  const w = newWalker(spawn);
  goTo(w, { x: spawn.x + 5, y: spawn.y });
  advance(w, 5000);
  expect(w.cell).toEqual(spawn);
  advance(w, 5000);
  expect(w.cell).toEqual({ x: spawn.x + 1, y: spawn.y });
});

test('reduced motion jumps to the queued or final goal', () => {
  const w = newWalker(spawn);
  goTo(w, { x: spawn.x + 4, y: spawn.y });
  advance(w, 20);
  const queued = { x: spawn.x, y: spawn.y - 2 };
  expect(isWalkable(queued)).toBe(true);
  goTo(w, queued);
  snapToGoal(w);
  expect(w.cell).toEqual(queued);
  expect(w.route).toEqual([]);
  expect(w.progress).toBe(0);
});
