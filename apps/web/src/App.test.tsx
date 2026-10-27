import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { App } from './App';

test('identifies the product and accurately labels foundation scope', () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain('204. PROJECT GROUP');
  expect(html).toContain('Navigasi utama');
  expect(html).toContain('Lewati ke konten');
  expect(html).toContain('CEO manusia');
  expect(html).toContain('belum diaktifkan');
  expect(html).not.toContain('<canvas');
});
