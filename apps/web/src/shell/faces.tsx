import akira from '../../../../assets/runtime/characters/akira-face.png';
import aeri from '../../../../assets/runtime/characters/aeri-face.png';
import amy from '../../../../assets/runtime/characters/amy-face.png';
import kuro from '../../../../assets/runtime/characters/kuro-face.png';
import leo from '../../../../assets/runtime/characters/leo-face.png';
import mail from '../../../../assets/runtime/characters/mail-face.png';
import zegion from '../../../../assets/runtime/characters/zegion-face.png';

const faces: Record<string, string> = {
  Akira: akira,
  Aeri: aeri,
  Amy: amy,
  Kuro: kuro,
  Leo: leo,
  Mail: mail,
  Zegion: zegion,
};

// Profile picture cut from the character's own portrait; decorative, the name is next to it.
export function Face({
  name,
  className = '',
}: {
  name: string;
  className?: string;
}) {
  return (
    <span className={`avatar ${className}`} aria-hidden="true">
      {faces[name] ? (
        <img src={faces[name]} alt="" width="128" height="128" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
