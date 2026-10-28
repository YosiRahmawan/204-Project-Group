import { expect, test } from 'vitest';
import { cleanName, sniffType } from './files.js';

const bytes = (text: string) => Buffer.from(text, 'latin1');

test('recognises known types by their first bytes', () => {
  expect(sniffType(Buffer.from('ffd8ffe000104a46', 'hex'), 'a.jpg')).toBe(
    'image/jpeg',
  );
  expect(sniffType(bytes('%PDF-1.7'), 'a.pdf')).toBe('application/pdf');
  expect(sniffType(bytes('\0\0\0\x18ftypmp42'), 'a.mp4')).toBe('video/mp4');
  expect(sniffType(bytes('RIFF\0\0\0\0WEBPVP8 '), 'a.webp')).toBe('image/webp');
  expect(sniffType(bytes('catatan singkat'), 'catatan.txt')).toBe('text/plain');
});

test('the extension alone never makes a file acceptable', () => {
  expect(sniffType(bytes('MZ program'), 'a.png')).toBeNull();
  expect(sniffType(bytes('plain text'), 'a.exe')).toBeNull();
  expect(sniffType(bytes('PK\x03\x04'), 'a.zip')).toBeNull();
  expect(sniffType(bytes('PK\x03\x04'), 'a.docx')).toContain(
    'wordprocessingml',
  );
  // A "text" file with binary bytes is not text.
  expect(sniffType(bytes('abc\0def'), 'a.txt')).toBeNull();
});

test('names lose folders, control characters and quotes', () => {
  expect(cleanName('C:\\Users\\Leo\\..\\foto.png')).toBe('foto.png');
  expect(cleanName('../../etc/passwd')).toBe('passwd');
  expect(cleanName('a"b\x07c.png')).toBe('abc.png');
  expect(cleanName('')).toBe('file');
  expect(cleanName('x'.repeat(500)).length).toBe(120);
});
