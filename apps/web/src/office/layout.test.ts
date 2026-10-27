import { expect, test } from 'vitest';
import { findPath, toScreen, toGrid, isWalkable, columns, rows } from './model';
import { rooms, spawn, props, walls, roomAt } from './layout';

test('all eight areas have reachable destinations from the lobby', () => {
  expect(rooms.map((r) => r.name)).toEqual([
    'Lobby',
    'Main Workspace',
    'Approval Room',
    'Command Room',
    'Mushola',
    'Break Lounge',
    'Garden',
    'Pool Area',
  ]);
  for (const room of rooms) {
    expect(roomAt(room.destination)?.id).toBe(room.id);
    expect(isWalkable(room.destination)).toBe(true);
    const path = findPath(spawn, room.destination);
    if (room.destination.x !== spawn.x || room.destination.y !== spawn.y)
      expect(path.at(-1)).toEqual(room.destination);
    let previous = spawn;
    for (const cell of path) {
      expect(isWalkable(cell)).toBe(true);
      expect(
        Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y),
      ).toBe(1);
      previous = cell;
    }
  }
});
test('walls, water and furniture are blocked; invalid destinations rejected', () => {
  for (const wall of walls) expect(isWalkable(wall)).toBe(false);
  for (const prop of props) {
    for (let x = prop.x; x < prop.x + prop.w; x++)
      for (let y = prop.y; y < prop.y + prop.h; y++)
        expect(isWalkable({ x, y })).toBe(false);
  }
  for (const cell of [
    { x: -1, y: 1 },
    { x: columns, y: 1 },
    { x: 1, y: rows },
    { x: NaN, y: 1 },
    { x: 1.5, y: 1 },
  ])
    expect(findPath(spawn, cell)).toEqual([]);
  expect(findPath(spawn, spawn)).toEqual([]);
  expect(findPath(spawn, rooms[1]!.destination, () => false)).toEqual([]);
});
test('all map cells have one area and projection is reversible', () => {
  for (let x = 0; x < columns; x++)
    for (let y = 0; y < rows; y++) {
      const cell = { x, y };
      expect(roomAt(cell)).toBeDefined();
      expect(toGrid(toScreen(cell))).toEqual(cell);
    }
});
