import { findPath, isWalkable, toScreen, type Cell } from './model';

export type Walker = {
  cell: Cell;
  route: Cell[];
  pending: Cell | null;
  progress: number;
};
export type GoResult =
  'blocked' | 'queued' | 'unreachable' | 'started' | 'here';

// One grid step takes this long.
export const stepMs = 90;

export const newWalker = (cell: Cell): Walker => ({
  cell: { ...cell },
  route: [],
  pending: null,
  progress: 0,
});

export function goTo(w: Walker, goal: Cell, walkable = isWalkable): GoResult {
  if (!isWalkable(goal) || !walkable(goal)) return 'blocked';
  // Finish the current adjacent step before rerouting; never cut a corner.
  if (w.progress > 0) {
    w.pending = goal;
    return 'queued';
  }
  const route = findPath(w.cell, goal, walkable);
  if (!route.length && (w.cell.x !== goal.x || w.cell.y !== goal.y))
    return 'unreachable';
  w.pending = null;
  w.route = route;
  return route.length ? 'started' : 'here';
}

// Returns 'arrived' on the frame the last step of a route completes.
export function advance(
  w: Walker,
  deltaMs: number,
  walkable = isWalkable,
): 'idle' | 'moving' | 'arrived' {
  const target = w.route[0];
  if (!target) return 'idle';
  // A long frame (tab in background) must not skip cells.
  w.progress = Math.min(1, w.progress + Math.min(deltaMs, 50) / stepMs);
  if (w.progress < 1) return 'moving';
  w.cell = target;
  w.route.shift();
  w.progress = 0;
  const pending = w.pending;
  w.pending = null;
  if (pending) goTo(w, pending, walkable);
  return w.route.length ? 'moving' : 'arrived';
}

// Reduced motion: jump straight to the final destination.
export function snapToGoal(w: Walker) {
  w.cell = w.pending ?? w.route.at(-1) ?? w.cell;
  w.route = [];
  w.pending = null;
  w.progress = 0;
}

export function walkerPoint(w: Walker): Cell {
  const a = toScreen(w.cell);
  const next = w.route[0];
  if (!next) return a;
  const b = toScreen(next);
  return {
    x: a.x + (b.x - a.x) * w.progress,
    y: a.y + (b.y - a.y) * w.progress,
  };
}

export type Heading = 'down' | 'up' | 'left' | 'right';
export function heading(w: Walker): Heading | null {
  const next = w.route[0];
  if (!next) return null;
  if (next.x !== w.cell.x) return next.x > w.cell.x ? 'right' : 'left';
  return next.y > w.cell.y ? 'down' : 'up';
}
