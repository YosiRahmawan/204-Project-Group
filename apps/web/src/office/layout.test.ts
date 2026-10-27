import { expect, test } from 'vitest';
import { findPath, toScreen, toGrid, isWalkable, columns, rows } from './model';
import { rooms, spawn, roomAt } from './layout';
import { characters } from './characters';

test('all eight areas have reachable destinations from the entrance', () => {
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
  expect(isWalkable(spawn)).toBe(true);
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
test('every area can be reached from every other area', () => {
  for (const from of rooms)
    for (const to of rooms)
      if (from !== to)
        expect(
          findPath(from.destination, to.destination).length,
        ).toBeGreaterThan(0);
});
test('furniture, water and walls are blocked; invalid destinations rejected', () => {
  // Reception desk, pool water and the lobby sign wall, in map pixels.
  for (const px of [
    { x: 760, y: 775 },
    { x: 1200, y: 200 },
    { x: 760, y: 700 },
  ])
    expect(isWalkable(toGrid(px))).toBe(false);
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
test('projection is reversible', () => {
  for (let x = 0; x < columns; x++)
    for (let y = 0; y < rows; y++)
      expect(toGrid(toScreen({ x, y }))).toEqual({ x, y });
});

test('every character starts on its own walkable cell inside an area', () => {
  const cells = characters.map((c) => toGrid(c.home));
  for (const cell of cells) {
    expect(isWalkable(cell)).toBe(true);
    expect(roomAt(cell)).toBeDefined();
  }
  expect(new Set(cells.map((c) => `${c.x},${c.y}`)).size).toBe(cells.length);
  // Everyone can be reached from the controlled character's start.
  for (const cell of cells)
    if (cell.x !== spawn.x || cell.y !== spawn.y)
      expect(findPath(spawn, cell).length).toBeGreaterThan(0);
});
