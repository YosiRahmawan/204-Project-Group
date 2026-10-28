import { basename, extname } from 'node:path';

const startsWith = (bytes: Buffer, signature: number[], offset = 0) =>
  signature.every((value, i) => bytes[offset + i] === value);
const ascii = (bytes: Buffer, from: number, to: number) =>
  bytes.subarray(from, to).toString('latin1');

const officeTypes: Record<string, string> = {
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const oldOfficeTypes: Record<string, string> = {
  '.doc': 'application/msword',
  '.xls': 'application/vnd.ms-excel',
  '.ppt': 'application/vnd.ms-powerpoint',
};
const textTypes: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/plain',
  '.csv': 'text/csv',
};

// The real type of an upload, decided from its first bytes, never from what the browser
// claims. Returns null for anything that is not a known photo, document or media file.
export function sniffType(bytes: Buffer, fileName: string): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')
    return 'image/gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP')
    return 'image/webp';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE')
    return 'audio/wav';
  if (ascii(bytes, 0, 5) === '%PDF-') return 'application/pdf';
  if (ascii(bytes, 4, 8) === 'ftyp') return 'video/mp4';
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  if (
    ascii(bytes, 0, 3) === 'ID3' ||
    (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
  )
    return 'audio/mpeg';
  const ext = extname(fileName).toLowerCase();
  // Office files are zip archives; only the three document extensions are accepted.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]))
    return officeTypes[ext] ?? null;
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return oldOfficeTypes[ext] ?? null;
  if (textTypes[ext]) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, 4096));
      return bytes.subarray(0, 4096).includes(0) ? null : textTypes[ext]!;
    } catch {
      return null;
    }
  }
  return null;
}

// A name that is safe to store and to put in a download header.
export function cleanName(raw: string): string {
  const name = basename(raw.replaceAll('\\', '/'))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"]/g, '')
    .trim()
    .slice(0, 120);
  return name || 'file';
}
