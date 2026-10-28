import { team } from '../shell/team';
import sprites from '../../../../assets/runtime/characters/manifest.json';
import akira from '../../../../assets/runtime/characters/akira.png';
import aeri from '../../../../assets/runtime/characters/aeri.png';
import amy from '../../../../assets/runtime/characters/amy.png';
import kuro from '../../../../assets/runtime/characters/kuro.png';
import leo from '../../../../assets/runtime/characters/leo.png';
import mail from '../../../../assets/runtime/characters/mail.png';
import zegion from '../../../../assets/runtime/characters/zegion.png';

export type Person = {
  id: keyof typeof sprites;
  name: string;
  // Zone label, shown in the team profile.
  room: string;
  atlas: string;
  // Where the feet stand, in the 1376 × 768 map space.
  x: number;
  y: number;
};

export const people: Person[] = [
  { id: 'leo', name: 'Leo', room: 'Command Room', atlas: leo, x: 1062, y: 606 },
  {
    id: 'zegion',
    name: 'Zegion',
    room: 'Command Room',
    atlas: zegion,
    x: 985,
    y: 614,
  },
  { id: 'akira', name: 'Akira', room: 'Lobby', atlas: akira, x: 676, y: 642 },
  {
    id: 'aeri',
    name: 'Aeri',
    room: 'Main Workspace',
    atlas: aeri,
    x: 590,
    y: 402,
  },
  {
    id: 'amy',
    name: 'Amy',
    room: 'Main Workspace',
    atlas: amy,
    x: 640,
    y: 484,
  },
  {
    id: 'kuro',
    name: 'Kuro',
    room: 'Main Workspace',
    atlas: kuro,
    x: 772,
    y: 402,
  },
  {
    id: 'mail',
    name: 'Mail',
    room: 'Main Workspace',
    atlas: mail,
    x: 830,
    y: 484,
  },
];

// Everyone is drawn about 52 map pixels tall; the manifest scale evens out the sheets.
export function personSize(id: Person['id']) {
  const { frame, scale } = sprites[id];
  const height = frame.height * scale * (52 / 72);
  return { width: (frame.width / frame.height) * height, height };
}

export const sheet = sprites;
// Leo is the human owner, so he is not in the team list of AI agents.
export const roleOf = (name: string) =>
  team.find((member) => member.name === name)?.role ?? 'CEO';
export const roomOf = (name: string) =>
  people.find((p) => p.name === name)?.room;
