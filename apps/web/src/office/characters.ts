import manifest from '../../../../assets/runtime/characters/manifest.json';
import akira from '../../../../assets/runtime/characters/akira.png';
import aeri from '../../../../assets/runtime/characters/aeri.png';
import amy from '../../../../assets/runtime/characters/amy.png';
import kuro from '../../../../assets/runtime/characters/kuro.png';
import leo from '../../../../assets/runtime/characters/leo.png';
import mail from '../../../../assets/runtime/characters/mail.png';
import zegion from '../../../../assets/runtime/characters/zegion.png';

export type CharacterId = keyof typeof manifest;
export type Character = {
  id: CharacterId;
  name: string;
  url: string;
  // Idle position in map pixels; Akira is the one the CEO moves.
  home: { x: number; y: number };
};

export const characters: Character[] = [
  { id: 'akira', name: 'AKIRA', url: akira, home: { x: 760, y: 856 } },
  { id: 'leo', name: 'LEO', url: leo, home: { x: 1300, y: 770 } },
  { id: 'aeri', name: 'AERI', url: aeri, home: { x: 600, y: 520 } },
  { id: 'amy', name: 'AMY', url: amy, home: { x: 650, y: 520 } },
  { id: 'kuro', name: 'KURO', url: kuro, home: { x: 890, y: 520 } },
  { id: 'mail', name: 'MAIL', url: mail, home: { x: 940, y: 520 } },
  { id: 'zegion', name: 'ZEGION', url: zegion, home: { x: 1100, y: 696 } },
];
export const spriteInfo = manifest;
