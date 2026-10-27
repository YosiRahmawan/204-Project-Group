import { isOpen, rooms } from './layout';
export type Cell = { x: number; y: number };
// The reference map is 1536 × 1024 px; the nav grid is screen-aligned, 16 px per cell.
export const mapWidth = 1536;
export const mapHeight = 1024;
export const tile = 16;
export const columns = mapWidth / tile;
export const rows = mapHeight / tile;
export const destinations = rooms.map((r) => ({
  name: r.name,
  ...r.destination,
}));
export function toScreen({ x, y }: Cell): Cell {
  return { x: x * tile + tile / 2, y: y * tile + tile / 2 };
}
export function toGrid({ x, y }: Cell): Cell {
  return { x: Math.floor(x / tile), y: Math.floor(y / tile) };
}
export function isWalkable({ x, y }: Cell): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    x < columns &&
    y >= 0 &&
    y < rows &&
    isOpen(x, y)
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
