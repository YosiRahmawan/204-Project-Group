import { blocked, props, rooms } from './layout';
export type Cell = { x: number; y: number };
export const columns = 30;
export const rows = 30;
export const desks = props.filter((p) => p.kind === 'desk');
export const destinations = rooms.map((r) => ({
  name: r.name,
  ...r.destination,
}));
export function toScreen({ x, y }: Cell): Cell {
  return { x: (x - y) * 32, y: (x + y) * 16 };
}
export function toGrid({ x, y }: Cell): Cell {
  return { x: Math.round(x / 64 + y / 32), y: Math.round(y / 32 - x / 64) };
}
export function isWalkable({ x, y }: Cell): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    x < columns &&
    y >= 0 &&
    y < rows &&
    !blocked.has(`${x},${y}`)
  );
}
const key = ({ x, y }: Cell) => `${x},${y}`;
export function findPath(
  start: Cell,
  goal: Cell,
  walkable = isWalkable,
): Cell[] {
  if (!isWalkable(start) || !isWalkable(goal) || !walkable(goal)) return [];
  const queue = [start];
  const previous = new Map<string, Cell | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!;
    if (key(current) === key(goal)) {
      const path: Cell[] = [];
      let cursor = current;
      while (key(cursor) !== key(start)) {
        path.unshift(cursor);
        cursor = previous.get(key(cursor))!;
      }
      return path;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (isWalkable(next) && walkable(next) && !previous.has(key(next))) {
        previous.set(key(next), current);
        queue.push(next);
      }
    }
  }
  return [];
}
