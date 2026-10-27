import type { Cell } from './model';

// The office is drawn from this plan, in cells of 16 px on a 96 × 64 grid. Rooms are
// interior rectangles; walls grow around them and doors are gaps cut into those walls,
// so a wall can never be walked through and a doorway is always open.
export type Rect = readonly [x: number, y: number, w: number, h: number];
export type Floor =
  'marble' | 'wood' | 'tile' | 'grass' | 'deck' | 'prayer' | 'stone';
export type Room = {
  id: string;
  name: string;
  note: string;
  // Pixel rectangle, used for the camera focus.
  x: number;
  y: number;
  w: number;
  h: number;
  destination: Cell;
};
type RoomSpec = {
  id: string;
  area: string;
  name: string;
  note: string;
  floor: Floor;
  indoor: boolean;
  rect: Rect;
  goal: readonly [number, number];
};

const room = (
  id: string,
  name: string,
  note: string,
  floor: Floor,
  indoor: boolean,
  rect: Rect,
  goal: readonly [number, number],
  area = id,
): RoomSpec => ({ id, area, name, note, floor, indoor, rect, goal });

// Laid out after the reference plan: garden and pool across the top, the Main Workspace
// in the middle, Mushola and Break Lounge on the left, Approval and Command on the right
// and the Lobby with its entrance steps at the bottom.
const specs: RoomSpec[] = [
  room(
    'lobby',
    'Lobby',
    'Welcome to 204.',
    'marble',
    true,
    [28, 43, 34, 13],
    [47, 51],
  ),
  room(
    'workspace',
    'Main Workspace',
    'Create • collaborate • grow',
    'marble',
    true,
    [31, 18, 31, 24],
    [48, 30],
  ),
  room(
    'approval',
    'Approval Room',
    'Meeting & review',
    'wood',
    true,
    [63, 19, 21, 15],
    [80, 30],
  ),
  room(
    'command',
    'Command Room',
    'Owner dashboard',
    'marble',
    true,
    [63, 35, 29, 15],
    [75, 47],
  ),
  room(
    'mushola',
    'Mushola',
    'Prayer room',
    'prayer',
    true,
    [19, 17, 11, 8],
    [28, 23],
  ),
  room(
    'lounge',
    'Break Lounge',
    'Rest & recharge',
    'wood',
    true,
    [6, 26, 24, 15],
    [14, 31],
  ),
  room(
    'garden',
    'Garden',
    'A moment to breathe',
    'grass',
    false,
    [29, 4, 33, 13],
    [46, 13],
  ),
  room(
    'pool',
    'Pool Area',
    'Relax & refresh',
    'deck',
    false,
    [63, 4, 29, 14],
    [75, 16],
  ),
  room(
    'washroom',
    'Washroom',
    '',
    'tile',
    true,
    [12, 18, 6, 7],
    [14, 22],
    'mushola',
  ),
  room(
    'alcove',
    'Alcove',
    '',
    'prayer',
    true,
    [24, 11, 6, 5],
    [27, 13],
    'mushola',
  ),
  room(
    'entrance',
    'Entrance',
    '',
    'stone',
    false,
    [41, 57, 13, 6],
    [47, 59],
    'lobby',
  ),
];

// Gaps in the walls between two rooms: always open, never closed doors.
export const doors: Rect[] = [
  [34, 17, 5, 1],
  [55, 17, 5, 1],
  [80, 18, 3, 1],
  [62, 8, 1, 4],
  [62, 24, 1, 4],
  [62, 36, 1, 3],
  [65, 34, 5, 1],
  [32, 42, 5, 1],
  [56, 42, 5, 1],
  [62, 45, 1, 4],
  [30, 19, 1, 3],
  [30, 33, 1, 4],
  [18, 20, 1, 3],
  [22, 25, 4, 1],
  [26, 16, 2, 1],
  [43, 56, 8, 1],
];

export type PropKind =
  | 'workstations'
  | 'planter'
  | 'meeting'
  | 'reception'
  | 'signwall'
  | 'screenwall'
  | 'sofa'
  | 'armchair'
  | 'table'
  | 'plant'
  | 'tree'
  | 'bigtree'
  | 'blossom'
  | 'palm'
  | 'bench'
  | 'lamp'
  | 'shelf'
  | 'counter'
  | 'stools'
  | 'console'
  | 'mihrab'
  | 'lounger'
  | 'umbrella'
  | 'hedge'
  | 'rug'
  | 'prayerrug'
  | 'paving'
  | 'water'
  | 'steps';
export type Prop = {
  kind: PropKind;
  x: number;
  y: number;
  w: number;
  h: number;
  // Which side the back of a sofa is on.
  dir?: 'n' | 'e' | 's' | 'w';
  // Walls carry this prop; it does not need floor under it.
  onWall?: boolean;
  // Decoration on the floor does not block walking.
  flat?: boolean;
};
const p = (
  kind: PropKind,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<Prop> = {},
): Prop => ({ kind, x, y, w, h, ...extra });

const plants = (cells: number[][]) =>
  cells.map(([x, y]) => p('plant', x!, y!, 1, 1));
const trees = (cells: number[][]) =>
  cells.map(([x, y]) => p('tree', x!, y!, 1, 1));
const palms = (cells: number[][]) =>
  cells.map(([x, y]) => p('palm', x!, y!, 1, 1));
const lamps = (cells: number[][]) =>
  cells.map(([x, y]) => p('lamp', x!, y!, 1, 1));

export const props: Prop[] = [
  // Main Workspace
  p('workstations', 36, 24, 8, 4),
  p('workstations', 52, 24, 8, 4),
  p('workstations', 36, 34, 8, 4),
  p('workstations', 52, 34, 8, 4),
  p('planter', 47, 25, 2, 2),
  p('planter', 47, 35, 2, 2),
  p('meeting', 44, 19, 8, 3),
  ...plants([
    [32, 19],
    [60, 19],
    [32, 40],
    [60, 40],
    [32, 29],
    [60, 29],
    [32, 36],
    [60, 36],
    [41, 31],
    [55, 31],
  ]),
  // Lobby
  p('signwall', 42, 42, 12, 1, { onWall: true }),
  p('rug', 29, 45, 8, 9, { flat: true }),
  p('rug', 54, 45, 8, 9, { flat: true }),
  p('reception', 44, 46, 9, 3),
  p('sofa', 29, 47, 2, 6, { dir: 'w' }),
  p('armchair', 29, 45, 2, 2),
  p('table', 33, 48, 2, 2),
  p('table', 33, 51, 2, 2),
  p('sofa', 59, 47, 2, 6, { dir: 'e' }),
  p('armchair', 59, 45, 2, 2),
  p('table', 56, 48, 2, 2),
  p('table', 56, 51, 2, 2),
  ...plants([
    [29, 54],
    [60, 54],
    [38, 44],
    [53, 44],
    [40, 54],
    [52, 54],
    [38, 51],
    [53, 51],
  ]),
  ...palms([
    [42, 58],
    [51, 58],
    [42, 61],
    [51, 61],
  ]),
  p('steps', 43, 57, 8, 5, { flat: true }),
  // Command Room
  p('screenwall', 72, 34, 13, 1, { onWall: true }),
  p('rug', 66, 38, 22, 10, { flat: true }),
  p('console', 70, 41, 17, 4),
  p('shelf', 91, 36, 1, 10),
  ...plants([
    [64, 49],
    [90, 49],
    [66, 36],
    [88, 36],
    [75, 48],
    [84, 48],
  ]),
  // Approval Room
  p('screenwall', 69, 18, 11, 1, { onWall: true }),
  p('counter', 69, 20, 10, 1),
  p('rug', 66, 22, 15, 9, { flat: true }),
  p('meeting', 70, 24, 9, 5),
  p('shelf', 63, 19, 1, 4),
  p('shelf', 83, 19, 1, 6),
  ...plants([
    [64, 32],
    [83, 32],
    [64, 29],
  ]),
  // Break Lounge
  p('counter', 8, 27, 12, 2),
  p('stools', 9, 29, 10, 1),
  p('shelf', 6, 27, 1, 6),
  p('rug', 9, 32, 14, 8, { flat: true }),
  p('sofa', 11, 33, 8, 2),
  p('sofa', 20, 33, 2, 6, { dir: 'e' }),
  p('sofa', 11, 38, 6, 2, { dir: 's' }),
  p('table', 13, 35, 2, 2),
  p('table', 16, 35, 2, 2),
  p('counter', 25, 30, 2, 8),
  ...plants([
    [7, 40],
    [28, 40],
    [28, 27],
    [7, 38],
    [8, 31],
    [24, 39],
  ]),
  // Mushola, Alcove and Washroom
  p('mihrab', 20, 16, 4, 1, { onWall: true }),
  p('prayerrug', 21, 19, 3, 2, { flat: true }),
  p('prayerrug', 25, 19, 3, 2, { flat: true }),
  p('prayerrug', 21, 21, 3, 2, { flat: true }),
  p('prayerrug', 25, 21, 3, 2, { flat: true }),
  p('shelf', 19, 17, 1, 2),
  p('shelf', 24, 11, 6, 1),
  p('plant', 29, 15, 1, 1),
  p('counter', 12, 18, 5, 1),
  p('plant', 12, 24, 1, 1),
  // Garden
  p('paving', 38, 8, 11, 8, { flat: true }),
  p('bigtree', 42, 10, 2, 2),
  p('blossom', 53, 9, 1, 1),
  p('blossom', 56, 12, 1, 1),
  ...trees([
    [30, 5],
    [32, 5],
    [34, 5],
    [30, 8],
    [33, 9],
    [30, 12],
    [32, 14],
    [50, 6],
    [55, 5],
    [58, 8],
    [58, 14],
    [48, 14],
    [36, 14],
    [59, 5],
    [40, 5],
    [46, 5],
  ]),
  p('hedge', 33, 11, 5, 1),
  p('hedge', 50, 12, 5, 1),
  p('bench', 34, 8, 3, 1),
  p('bench', 51, 15, 3, 1),
  ...lamps([
    [38, 6],
    [49, 6],
    [37, 15],
    [49, 8],
    [32, 10],
  ]),
  // Pool Area
  p('water', 67, 9, 16, 7),
  p('water', 84, 8, 5, 4),
  p('lounger', 64, 9, 2, 1),
  p('lounger', 64, 11, 2, 1),
  p('lounger', 64, 13, 2, 1),
  p('umbrella', 70, 17, 1, 1),
  p('umbrella', 85, 15, 1, 1),
  p('counter', 64, 5, 7, 2),
  ...palms([
    [63, 4],
    [90, 4],
    [91, 13],
    [63, 16],
    [91, 16],
    [88, 6],
  ]),
  ...lamps([
    [66, 8],
    [83, 8],
    [84, 14],
  ]),
];

const key = (x: number, y: number) => `${x},${y}`;
const each = ([x, y, w, h]: Rect, visit: (x: number, y: number) => void) => {
  for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) visit(i, j);
};

// cell -> room id for every floor cell (interior and door gaps).
const owner = new Map<string, string>();
for (const spec of specs)
  each(spec.rect, (x, y) => owner.set(key(x, y), spec.id));
export const doorCells = new Set<string>();
for (const door of doors)
  each(door, (x, y) => {
    doorCells.add(key(x, y));
    const side = [
      [x, y - 1],
      [x - 1, y],
      [x, y + 1],
      [x + 1, y],
    ]
      .map(([nx, ny]) => owner.get(key(nx!, ny!)))
      .find((id) => id !== undefined);
    owner.set(key(x, y), side ?? 'lobby');
  });
export const floorOf = (x: number, y: number) =>
  specs.find((s) => s.id === owner.get(key(x, y)))?.floor;

export type WallKind = 'solid' | 'hedge' | 'low';
export type Wall = { kind: WallKind; exterior: boolean; jamb: boolean };
export const walls = new Map<string, Wall>();
{
  const interior = new Set(owner.keys());
  for (const spec of specs)
    each(spec.rect, (x, y) => {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const k = key(x + dx, y + dy);
          if (interior.has(k) || walls.has(k)) continue;
          // Indoor rooms make real walls; gardens and the pool get a hedge or a low fence.
          walls.set(k, {
            kind: spec.indoor ? 'solid' : spec.id === 'pool' ? 'low' : 'hedge',
            exterior: false,
            jamb: false,
          });
        }
    });
  // A wall touching any indoor room is solid, whatever else is next to it.
  for (const spec of specs.filter((s) => s.indoor))
    each(spec.rect, (x, y) => {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const wall = walls.get(key(x + dx, y + dy));
          if (wall) wall.kind = 'solid';
        }
    });
  for (const [k, wall] of walls) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    const around = [
      [x, y - 1],
      [x, y + 1],
      [x - 1, y],
      [x + 1, y],
    ] as const;
    wall.exterior = around.some(
      ([nx, ny]) => !interior.has(key(nx, ny)) && !walls.has(key(nx, ny)),
    );
    wall.jamb = around.some(([nx, ny]) => doorCells.has(key(nx, ny)));
  }
}

// Blocked cells: walls, water and the footprint of every solid prop.
const blocked = new Set(walls.keys());
for (const prop of props)
  if (!prop.flat && !prop.onWall)
    each([prop.x, prop.y, prop.w, prop.h], (x, y) => blocked.add(key(x, y)));
export const isOpen = (x: number, y: number) =>
  owner.has(key(x, y)) && !blocked.has(key(x, y));

export const rooms: Room[] = specs
  .filter((s) => s.note)
  .map((s) => ({
    id: s.id,
    name: s.name,
    note: s.note,
    x: s.rect[0] * 16,
    y: s.rect[1] * 16,
    w: s.rect[2] * 16,
    h: s.rect[3] * 16,
    destination: { x: s.goal[0], y: s.goal[1] },
  }));
const areaName = new Map(specs.map((s) => [s.id, s.area]));
export const spawn = { x: 47, y: 53 };
export const roomAt = ({ x, y }: Cell) => {
  const id = owner.get(key(x, y));
  const area = id ? areaName.get(id) : undefined;
  return rooms.find((r) => r.id === area);
};
