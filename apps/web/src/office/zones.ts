// The eight zones of the isometric floor plan. Coordinates are in the 1376 × 768 space of
// assets/runtime/maps/office-iso.jpg.
export type Zone = {
  id: string;
  tag: string;
  name: string;
  // Short name and one-line note for the zone buttons under the map.
  label: string;
  note: string;
  // Clickable outline of the zone on the map; the camera zooms to fit it.
  points: string;
};

// Rectangular outline as a polygon point list.
const rect = (x: number, y: number, w: number, h: number) =>
  `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;

export const zones: Zone[] = [
  {
    id: 'lobby',
    tag: 'ZONE 01',
    name: 'Lobby & Main Entrance',
    label: 'Lobby',
    note: 'Welcome to 204.',
    points: rect(425, 495, 480, 265),
  },
  {
    id: 'workspace',
    tag: 'ZONE 02',
    name: 'Main Workspace Hub',
    label: 'Main Workspace',
    note: 'Create • collaborate • grow',
    points: rect(470, 270, 420, 230),
  },
  {
    id: 'approval',
    tag: 'ZONE 03',
    name: 'Approval & Review Boardroom',
    label: 'Approval Room',
    note: 'Meeting & review',
    points: rect(880, 245, 330, 190),
  },
  {
    id: 'command',
    tag: 'ZONE 04',
    name: 'Command Room (Operations Dashboard)',
    label: 'Command Room',
    note: 'Owner dashboard',
    points: rect(910, 430, 340, 210),
  },
  {
    id: 'mushola',
    tag: 'ZONE 05',
    name: 'Mushola (Prayer Sanctuary)',
    label: 'Mushola',
    note: 'Prayer room',
    points: rect(210, 150, 280, 190),
  },
  {
    id: 'lounge',
    tag: 'ZONE 06',
    name: 'Break Lounge & Pantry Bar',
    label: 'Break Lounge',
    note: 'Rest & recharge',
    points: rect(120, 340, 350, 220),
  },
  {
    id: 'garden',
    tag: 'ZONE 07',
    name: 'Courtyard Zen Garden',
    label: 'Garden',
    note: 'A moment to breathe',
    points: rect(430, 10, 430, 260),
  },
  {
    id: 'pool',
    tag: 'ZONE 08',
    name: 'Resort Pool & Jacuzzi Deck',
    label: 'Pool Area',
    note: 'Relax & refresh',
    points: rect(850, 30, 410, 230),
  },
];
