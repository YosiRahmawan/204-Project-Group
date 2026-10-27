import type { Cell } from './model';
// Everything below is measured in pixels of Img/Map/Denah Kantor Mewah 204. Project Group.png.
type Rect = readonly [x: number, y: number, w: number, h: number];
export type Room = {
  id: string;
  name: string;
  note: string;
  x: number;
  y: number;
  w: number;
  h: number;
  destination: Cell;
};
type RoomSpec = Pick<Room, 'id' | 'name' | 'note'> & {
  floor: Rect[];
  goal: Cell;
};
const specs: RoomSpec[] = [
  {
    id: 'lobby',
    name: 'Lobby',
    note: 'Welcome to 204.',
    floor: [
      [470, 745, 600, 160],
      [655, 905, 215, 85],
    ],
    goal: { x: 760, y: 830 },
  },
  {
    id: 'workspace',
    name: 'Main Workspace',
    note: 'Create • collaborate • grow',
    floor: [[515, 355, 515, 390]],
    goal: { x: 770, y: 505 },
  },
  {
    id: 'approval',
    name: 'Approval Room',
    note: 'Meeting & review',
    floor: [
      [1030, 330, 300, 230],
      [1150, 560, 80, 25],
    ],
    goal: { x: 1300, y: 480 },
  },
  {
    id: 'command',
    name: 'Command Room',
    note: 'Owner dashboard',
    floor: [
      [1070, 585, 380, 215],
      [1060, 765, 20, 80],
    ],
    goal: { x: 1250, y: 770 },
  },
  {
    id: 'mushola',
    name: 'Mushola',
    note: 'Prayer room',
    floor: [
      [300, 300, 190, 105],
      [190, 300, 110, 105],
      [490, 335, 25, 65],
    ],
    goal: { x: 400, y: 380 },
  },
  {
    id: 'lounge',
    name: 'Break Lounge',
    note: 'Rest & recharge',
    floor: [
      [105, 440, 385, 210],
      [490, 520, 25, 80],
    ],
    goal: { x: 160, y: 570 },
  },
  {
    id: 'garden',
    name: 'Garden',
    note: 'A moment to breathe',
    floor: [
      [585, 100, 405, 190],
      [555, 290, 90, 65],
      [890, 290, 110, 65],
    ],
    goal: { x: 700, y: 255 },
  },
  {
    id: 'pool',
    name: 'Pool Area',
    note: 'Relax & refresh',
    floor: [
      [1000, 100, 450, 200],
      [1050, 300, 60, 35],
    ],
    goal: { x: 1230, y: 285 },
  },
];
// Furniture, walls, trees and water that the character must walk around.
const blocks: Rect[] = [
  [665, 665, 205, 85],
  [700, 755, 135, 45],
  [470, 765, 80, 95],
  [975, 765, 80, 95],
  [575, 405, 130, 95],
  [835, 405, 130, 95],
  [575, 535, 130, 90],
  [835, 535, 130, 90],
  [745, 405, 45, 60],
  [745, 545, 45, 55],
  [730, 350, 80, 40],
  [1120, 330, 150, 82],
  [1120, 425, 150, 100],
  [1130, 585, 270, 145],
  [170, 420, 290, 80],
  [215, 530, 135, 105],
  [360, 520, 50, 140],
  [625, 100, 125, 100],
  [850, 70, 85, 210],
  [1070, 145, 255, 125],
  [1335, 135, 85, 65],
  [990, 155, 50, 105],
  [1075, 215, 75, 75],
  [1340, 215, 90, 75],
  [1010, 80, 110, 50],
];
const inRect = (px: number, py: number, [x, y, w, h]: Rect) =>
  px >= x && px < x + w && py >= y && py < y + h;
const grid = 16;
const owner = new Map<string, string>();
for (let x = 0; x < 96; x++)
  for (let y = 0; y < 64; y++) {
    const px = x * grid + grid / 2;
    const py = y * grid + grid / 2;
    const room = specs.find((r) => r.floor.some((f) => inRect(px, py, f)));
    if (room && !blocks.some((b) => inRect(px, py, b)))
      owner.set(`${x},${y}`, room.id);
  }
export const isOpen = (x: number, y: number) => owner.has(`${x},${y}`);
export const rooms: Room[] = specs.map(({ floor, goal, ...room }) => {
  const x = Math.min(...floor.map((f) => f[0]));
  const y = Math.min(...floor.map((f) => f[1]));
  return {
    ...room,
    x,
    y,
    w: Math.max(...floor.map((f) => f[0] + f[2])) - x,
    h: Math.max(...floor.map((f) => f[1] + f[3])) - y,
    destination: { x: Math.floor(goal.x / grid), y: Math.floor(goal.y / grid) },
  };
});
export const spawn = { x: 47, y: 53 };
export const roomAt = ({ x, y }: Cell) =>
  rooms.find((r) => r.id === owner.get(`${x},${y}`));
