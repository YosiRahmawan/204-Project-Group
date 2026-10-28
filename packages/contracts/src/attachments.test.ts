import { expect, test } from 'vitest';
import { checkFiles, formatSize, maxBytes, maxFiles } from './attachments.js';

const file = (name: string, type: string, size = 1000) => ({
  name,
  type,
  size,
});

test('accepts photos, documents and media', () => {
  const { accepted, errors } = checkFiles(0, [
    file('a.png', 'image/png'),
    file('b.pdf', 'application/pdf'),
    file('c.mp4', 'video/mp4'),
    file(
      'd.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ),
  ]);
  expect(accepted).toEqual([0, 1, 2, 3]);
  expect(errors).toEqual([]);
});

test('rejects programs, archives, empty and oversized files with a reason', () => {
  const { accepted, errors } = checkFiles(0, [
    file('virus.exe', 'application/x-msdownload'),
    file('data.zip', 'application/zip'),
    file('empty.png', 'image/png', 0),
    file('huge.png', 'image/png', maxBytes + 1),
    file('ok.png', 'image/png'),
  ]);
  expect(accepted).toEqual([4]);
  expect(errors).toHaveLength(4);
});

test('stops at the attachment limit, counting files already chosen', () => {
  const many = Array.from({ length: 4 }, (_, i) =>
    file(`${i}.png`, 'image/png'),
  );
  const { accepted, errors } = checkFiles(maxFiles - 2, many);
  expect(accepted).toEqual([0, 1]);
  expect(errors).toHaveLength(2);
});

test('formats sizes', () => {
  expect(formatSize(512)).toBe('512 B');
  expect(formatSize(2048)).toBe('2 KB');
  expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
});
