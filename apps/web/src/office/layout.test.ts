import { expect, test } from 'vitest';
import { findPath, toScreen, toGrid, isWalkable, columns, rows } from './model';
import {
  doorCells,
  doors,
  floorOf,
  props,
  rooms,
  spawn,
  roomAt,
  walls,
} from './layout';
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
test('walls, solid furniture and water are blocked; invalid destinations rejected', () => {
  for (const key of walls.keys()) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    expect(isWalkable({ x, y })).toBe(false);
  }
  for (const prop of props.filter((q) => !q.flat && !q.onWall))
    for (let x = prop.x; x < prop.x + prop.w; x++)
      for (let y = prop.y; y < prop.y + prop.h; y++) {
        expect(isWalkable({ x, y })).toBe(false);
        expect(floorOf(x, y)).toBeDefined();
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
test('every doorway is open on both sides and no wall can be crossed', () => {
  for (const [x, y, w, h] of doors)
    for (let i = x; i < x + w; i++)
      for (let j = y; j < y + h; j++) {
        expect(walls.has(`${i},${j}`)).toBe(false);
        expect(isWalkable({ x: i, y: j })).toBe(true);
      }
  // Walking between two rooms always passes through a doorway.
  const path = findPath({ x: 47, y: 52 }, { x: 48, y: 30 });
  expect(path.length).toBeGreaterThan(0);
  expect(path.some((cell) => doorCells.has(`${cell.x},${cell.y}`))).toBe(true);
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
