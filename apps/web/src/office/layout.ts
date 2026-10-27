import type { Cell } from './model';
export type Room = {
  id: string;
  name: string;
  note: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  destination: Cell;
};
export const rooms: Room[] = [
  {
    id: 'lobby',
    name: 'Lobby',
    note: 'Welcome to 204.',
    x: 8,
    y: 24,
    w: 14,
    h: 6,
    color: 0xf1ede3,
    destination: { x: 14, y: 27 },
  },
  {
    id: 'workspace',
    name: 'Main Workspace',
    note: 'Create • collaborate • grow',
    x: 8,
    y: 9,
    w: 14,
    h: 15,
    color: 0xfaf9f4,
    destination: { x: 14, y: 20 },
  },
  {
    id: 'approval',
    name: 'Approval Room',
    note: 'Meeting & review',
    x: 22,
    y: 9,
    w: 8,
    h: 10,
    color: 0xf3eee4,
    destination: { x: 24, y: 16 },
  },
  {
    id: 'command',
    name: 'Command Room',
    note: 'Owner dashboard',
    x: 22,
    y: 19,
    w: 8,
    h: 11,
    color: 0xe8eeeb,
    destination: { x: 25, y: 26 },
  },
  {
    id: 'mushola',
    name: 'Mushola',
    note: 'Prayer room',
    x: 0,
    y: 9,
    w: 8,
    h: 8,
    color: 0xe8eee1,
    destination: { x: 5, y: 13 },
  },
  {
    id: 'lounge',
    name: 'Break Lounge',
    note: 'Rest & recharge',
    x: 0,
    y: 17,
    w: 8,
    h: 13,
    color: 0xf0e7d9,
    destination: { x: 5, y: 22 },
  },
  {
    id: 'garden',
    name: 'Garden',
    note: 'A moment to breathe',
    x: 0,
    y: 0,
    w: 14,
    h: 9,
    color: 0xc8d8b2,
    destination: { x: 10, y: 5 },
  },
  {
    id: 'pool',
    name: 'Pool Area',
    note: 'Relax & refresh',
    x: 14,
    y: 0,
    w: 16,
    h: 9,
    color: 0xe5d9be,
    destination: { x: 17, y: 5 },
  },
];
export const spawn = { x: 14, y: 27 };
export const roomAt = ({ x, y }: Cell) =>
  rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
export type Prop = Cell & {
  w: number;
  h: number;
  kind:
    | 'desk'
    | 'plant'
    | 'sofa'
    | 'table'
    | 'reception'
    | 'monitor'
    | 'rug'
    | 'water'
    | 'bench'
    | 'chair'
    | 'lounger';
  label?: string;
};
export const props: Prop[] = [
  ...[11, 15, 18].flatMap((x, i) =>
    [13, 17].map((y, j) => ({
      x,
      y,
      w: 2,
      h: 1,
      kind: 'desk' as const,
      label: ['AKIRA', 'AERI', 'AMY', 'KURO', 'MAIL', 'ZEGION'][i * 2 + j]!,
    })),
  ),
  { x: 11, y: 26, w: 3, h: 1, kind: 'reception', label: '204. PROJECT GROUP' },
  { x: 17, y: 26, w: 3, h: 1, kind: 'sofa' },
  { x: 25, y: 12, w: 2, h: 3, kind: 'table' },
  { x: 25, y: 11, w: 1, h: 1, kind: 'chair' },
  { x: 25, y: 15, w: 1, h: 1, kind: 'chair' },
  { x: 25, y: 10, w: 3, h: 1, kind: 'monitor', label: 'REVIEW' },
  { x: 24, y: 21, w: 4, h: 1, kind: 'monitor', label: '204. COMMAND' },
  { x: 25, y: 24, w: 2, h: 1, kind: 'desk', label: 'LEO' },
  ...[2, 4].flatMap((x) =>
    [11, 14].map((y) => ({ x, y, w: 1, h: 1, kind: 'rug' as const })),
  ),
  { x: 1, y: 19, w: 3, h: 1, kind: 'sofa' },
  { x: 1, y: 24, w: 1, h: 3, kind: 'sofa' },
  { x: 3, y: 23, w: 2, h: 2, kind: 'table' },
  { x: 3, y: 22, w: 1, h: 1, kind: 'chair' },
  { x: 3, y: 25, w: 1, h: 1, kind: 'chair' },
  { x: 2, y: 28, w: 3, h: 1, kind: 'reception', label: 'COFFEE' },
  { x: 19, y: 2, w: 8, h: 4, kind: 'water' },
  { x: 20, y: 7, w: 2, h: 1, kind: 'lounger' },
  { x: 24, y: 7, w: 2, h: 1, kind: 'lounger' },
  { x: 5, y: 4, w: 3, h: 1, kind: 'bench' },
  ...[
    { x: 2, y: 2 },
    { x: 5, y: 2 },
    { x: 9, y: 2 },
    { x: 2, y: 6 },
    { x: 11, y: 7 },
    { x: 16, y: 2 },
    { x: 28, y: 6 },
    { x: 9, y: 10 },
    { x: 20, y: 22 },
    { x: 1, y: 10 },
    { x: 6, y: 28 },
    { x: 28, y: 17 },
    { x: 28, y: 28 },
    { x: 9, y: 28 },
    { x: 20, y: 28 },
  ].map((p) => ({ ...p, w: 1, h: 1, kind: 'plant' as const })),
];
const doorKeys = new Set<string>();
function door(x: number, y: number, w: number, h: number) {
  for (let i = x; i < x + w; i++)
    for (let j = y; j < y + h; j++) doorKeys.add(`${i},${j}`);
}
door(10, 8, 2, 2);
door(18, 8, 2, 2);
door(7, 12, 2, 2);
door(7, 20, 2, 2);
door(21, 13, 2, 2);
door(21, 21, 2, 2);
door(14, 23, 2, 2);
door(7, 26, 2, 2);
door(25, 18, 2, 2);
door(13, 4, 2, 2);
door(14, 29, 2, 1);
export const walls: Cell[] = [];
for (let x = 0; x < 30; x++)
  for (let y = 0; y < 30; y++) {
    const r = roomAt({ x, y })!;
    if (
      (x === r.x || x === r.x + r.w - 1 || y === r.y || y === r.y + r.h - 1) &&
      !doorKeys.has(`${x},${y}`)
    )
      walls.push({ x, y });
  }
export const blocked = new Set(walls.map((p) => `${p.x},${p.y}`));
for (const p of props)
  for (let x = p.x; x < p.x + p.w; x++)
    for (let y = p.y; y < p.y + p.h; y++) blocked.add(`${x},${y}`);
