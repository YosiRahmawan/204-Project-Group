// Removes the area name plates, legend and logos from the reference floor plan so the
// map stays clean. Img/Map is never modified; the result goes to assets/runtime/maps/.
// Usage: node scripts/clean-map.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decodePng, encodePng } from './png.mjs';

const SOURCE = 'Img/Map/Denah Kantor Mewah 204. Project Group.png';
const OUT = 'assets/runtime/maps/';
const { width, height, rgb } = decodePng(readFileSync(SOURCE));
const mask = new Uint8Array(width * height);

const fill = (x0, y0, x1, y1) => {
  for (let y = Math.max(0, y0); y <= Math.min(height - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(width - 1, x1); x++)
      mask[y * width + x] = 1;
};

// Plates and the legend are the large near-black blobs: find them instead of guessing.
const dark = (p) => Math.max(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]) < 70;
const seen = new Uint8Array(width * height);
const found = [];
for (let start = 0; start < width * height; start++) {
  if (seen[start] || !dark(start)) continue;
  const stack = [start];
  seen[start] = 1;
  let x0 = width,
    y0 = height,
    x1 = 0,
    y1 = 0,
    area = 0;
  while (stack.length) {
    const p = stack.pop();
    const x = p % width,
      y = (p / width) | 0;
    area++;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    for (const n of [p - 1, p + 1, p - width, p + width]) {
      if (n < 0 || n >= width * height || seen[n] || !dark(n)) continue;
      if (Math.abs((n % width) - x) > 1) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  const w = x1 - x0 + 1,
    h = y1 - y0 + 1;
  const plate =
    w >= 130 && w <= 260 && h >= 40 && h <= 70 && area / (w * h) > 0.55;
  const legend = w >= 380 && w <= 420 && h >= 200 && h <= 240;
  if (plate || legend)
    found.push({ x0, y0, x1, y1, area, kind: plate ? 'plate' : 'legend' });
}
// The Command Room dashboard screen is as dark and wide as a plate but is part of the room.
const keep = (f) => f.x0 > 1170 && f.x0 < 1180 && f.y0 > 580 && f.y0 < 590;
const removed = found.filter((f) => !keep(f));
// Patch copying only looks right on plain marble (Main Workspace and Lobby); on busier
// spots it copies furniture, so those fall back to smooth diffusion below.
const marble = (f) =>
  (f.x0 === 660 && f.y0 === 474) || (f.x0 === 690 && f.y0 === 811);
const plates = removed
  .filter((f) => f.kind === 'plate' && marble(f))
  .map((f) => [f.x0 - 4, f.y0 - 4, f.x1 + 4, f.y1 + 4]);
for (const f of removed) fill(f.x0 - 4, f.y0 - 4, f.x1 + 4, f.y1 + 4);
console.log(
  found.map((f) => `${f.kind} ${f.x0},${f.y0}-${f.x1},${f.y1}`).join('\n'),
);

// Top-left logo and the bottom-right slogan sit outside the building.
fill(5, 15, 360, 180);
fill(1215, 915, 1490, 995);

const out = new Float32Array(rgb);

// Plates sit on floor and walls: copy the best-matching patch of similar surroundings,
// then blend the seam so the colours line up.
const ring = 6;
const integral = new Int32Array((width + 1) * (height + 1));
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++)
    integral[(y + 1) * (width + 1) + x + 1] =
      mask[y * width + x] +
      integral[y * (width + 1) + x + 1] +
      integral[(y + 1) * (width + 1) + x] -
      integral[y * (width + 1) + x];
const masked = (x0, y0, x1, y1) =>
  integral[(y1 + 1) * (width + 1) + x1 + 1] -
  integral[y0 * (width + 1) + x1 + 1] -
  integral[(y1 + 1) * (width + 1) + x0] +
  integral[y0 * (width + 1) + x0];
const patchFill = ([x0, y0, x1, y1]) => {
  const ringPixels = [];
  for (let y = y0 - ring; y <= y1 + ring; y += 2)
    for (let x = x0 - ring; x <= x1 + ring; x += 2)
      if (x < x0 || x > x1 || y < y0 || y > y1) ringPixels.push(y * width + x);
  let best = { cost: Infinity, dx: 0, dy: 0 };
  for (let dy = -300; dy <= 300; dy += 3)
    for (let dx = -420; dx <= 420; dx += 3) {
      const sx0 = x0 - ring + dx,
        sy0 = y0 - ring + dy,
        sx1 = x1 + ring + dx,
        sy1 = y1 + ring + dy;
      if (sx0 < 0 || sy0 < 0 || sx1 >= width || sy1 >= height) continue;
      if (masked(sx0, sy0, sx1, sy1)) continue;
      let cost = 0;
      for (const p of ringPixels) {
        const q = p + dy * width + dx;
        for (let c = 0; c < 3; c++) {
          const d = rgb[p * 3 + c] - rgb[q * 3 + c];
          cost += d * d;
        }
        if (cost >= best.cost) break;
      }
      if (cost < best.cost) best = { cost, dx, dy };
    }
  const { dx, dy } = best;
  const shift = dy * width + dx;
  const w = x1 - x0 + 1,
    h = y1 - y0 + 1;
  const diff = new Float32Array(w * h * 3);
  const edge = (x, y, c) =>
    x >= 0 && y >= 0 && x < w && y < h
      ? diff[(y * w + x) * 3 + c]
      : rgb[((y0 + y) * width + x0 + x) * 3 + c] -
        rgb[((y0 + y) * width + x0 + x + 0) * 3 + c + shift * 3];
  for (let pass = 0; pass < 400; pass++)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        for (let c = 0; c < 3; c++)
          diff[(y * w + x) * 3 + c] =
            (edge(x - 1, y, c) +
              edge(x + 1, y, c) +
              edge(x, y - 1, c) +
              edge(x, y + 1, c)) /
            4;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = (y0 + y) * width + x0 + x;
      for (let c = 0; c < 3; c++)
        out[p * 3 + c] = rgb[(p + shift) * 3 + c] + diff[(y * w + x) * 3 + c];
    }
};
for (const rect of plates) patchFill(rect);
for (const [x0, y0, x1, y1] of plates)
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) mask[y * width + x] = 0;

// Fill: copy the nearest known colour into the hole, then smooth it by diffusion.
const queue = [];
const queued = new Uint8Array(width * height);
const known = new Uint8Array(width * height);
for (let p = 0; p < width * height; p++) known[p] = mask[p] ? 0 : 1;
for (let p = 0; p < width * height; p++)
  if (!known[p]) {
    for (const n of [p - 1, p + 1, p - width, p + width])
      if (n >= 0 && n < width * height && known[n] && mask[p]) {
        queue.push(p);
        queued[p] = 1;
        break;
      }
  }
const filled = new Uint8Array(known);
for (let i = 0; i < queue.length; i++) {
  const p = queue[i];
  if (filled[p] && !mask[p]) continue;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (const q of [p - 1, p + 1, p - width, p + width])
    if (q >= 0 && q < width * height && filled[q]) {
      r += out[q * 3];
      g += out[q * 3 + 1];
      b += out[q * 3 + 2];
      n++;
    }
  if (!n) continue;
  out[p * 3] = r / n;
  out[p * 3 + 1] = g / n;
  out[p * 3 + 2] = b / n;
  filled[p] = 1;
  for (const q of [p - 1, p + 1, p - width, p + width])
    if (q >= 0 && q < width * height && mask[q] && !filled[q] && !queued[q]) {
      queued[q] = 1;
      queue.push(q);
    }
}
const holes = [];
for (let p = 0; p < width * height; p++) if (mask[p]) holes.push(p);
for (let pass = 0; pass < 600; pass++)
  for (const p of holes) {
    const x = p % width,
      y = (p / width) | 0;
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
    for (let c = 0; c < 3; c++)
      out[p * 3 + c] =
        (out[(p - 1) * 3 + c] +
          out[(p + 1) * 3 + c] +
          out[(p - width) * 3 + c] +
          out[(p + width) * 3 + c]) /
        4;
  }

const rgba = new Uint8Array(width * height * 4);
for (let p = 0; p < width * height; p++) {
  rgba[p * 4] = out[p * 3];
  rgba[p * 4 + 1] = out[p * 3 + 1];
  rgba[p * 4 + 2] = out[p * 3 + 2];
  rgba[p * 4 + 3] = 255;
}
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}office.png`, encodePng(width, height, rgba));
