// Cuts the character reference sheets in Img/Karakter into transparent runtime atlases.
// Usage: node scripts/build-sprites.mjs   (writes assets/runtime/characters/)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decodePng, encodePng } from './png.mjs';

const SRC = 'Img/Karakter/';
const OUT = 'assets/runtime/characters/';
const TARGET_HEIGHT = 72; // on-screen pixels for the idle front frame
// side = sheet row of the sideways walk, facing = direction the sheet draws it; up = back row.
const characters = [
  {
    id: 'akira',
    cols: 6,
    file: 'Akira-General manager-Lead cordinator.png',
    side: 1,
    up: 3,
    facing: 'right',
  },
  {
    id: 'aeri',
    cols: 4,
    file: 'Aeri-Brand Ambassador-Sosial media.png',
    side: 1,
    up: 2,
    facing: 'right',
  },
  {
    id: 'amy',
    cols: 4,
    file: 'Amy-Digital Marketing Spesialist.png',
    side: 1,
    up: 2,
    facing: 'right',
  },
  {
    id: 'kuro',
    cols: 4,
    file: 'Kuro-Art Director-Lead Deigner.png',
    side: 1,
    up: 2,
    facing: 'left',
  },
  { id: 'leo', cols: 4, file: 'Leo-Ceo.png', side: 1, up: 2, facing: 'left' },
  {
    id: 'mail',
    cols: 4,
    file: 'Mail-Finance Manager.png',
    side: 1,
    up: 2,
    facing: 'right',
  },
  {
    id: 'zegion',
    cols: 6,
    file: 'Zegion-Tecknology-Security-Reliability.png',
    side: 1,
    up: 2,
    facing: 'left',
  },
];

// Light neutral pixels are sheet background or panel lines, never artwork.
function isBackground(rgb, i) {
  const r = rgb[i],
    g = rgb[i + 1],
    b = rgb[i + 2];
  return (
    Math.min(r, g, b) >= 170 && Math.max(r, g, b) - Math.min(r, g, b) <= 18
  );
}

// Background is the light neutral area connected to the sheet edge, so light artwork
// (silver hair, white shirts) stays opaque as long as its outline is closed.
function backgroundMask({ width, height, rgb }) {
  const bg = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length) {
    const p = stack.pop();
    if (bg[p] || !isBackground(rgb, p * 3)) continue;
    bg[p] = 1;
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < width * (height - 1)) stack.push(p + width);
  }
  return bg;
}

function label({ width, height }, bg) {
  const labels = new Int32Array(width * height);
  const parts = [];
  const queue = new Int32Array(width * height);
  for (let start = 0; start < width * height; start++) {
    if (labels[start] || bg[start]) continue;
    const id = parts.length + 1;
    const part = { id, x0: width, y0: height, x1: 0, y1: 0, area: 0 };
    let head = 0,
      tail = 0;
    queue[tail++] = start;
    labels[start] = id;
    while (head < tail) {
      const p = queue[head++];
      const px = p % width,
        py = (p / width) | 0;
      part.area++;
      part.x0 = Math.min(part.x0, px);
      part.x1 = Math.max(part.x1, px);
      part.y0 = Math.min(part.y0, py);
      part.y1 = Math.max(part.y1, py);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx,
            ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (labels[n] || bg[n]) continue;
          labels[n] = id;
          queue[tail++] = n;
        }
    }
    parts.push(part);
  }
  return { labels, parts };
}

// Light pockets trapped behind thin strands of hair are leftover sheet background:
// clear small ones that sit within 2 px of the transparent area.
function removeSpecks(out, w, h, rgb, sheet, x0, y0) {
  const light = (x, y) => {
    const o = (y * w + x) * 4;
    if (!out[o + 3]) return false;
    const i = ((y0 + y) * sheet.width + x0 + x) * 3;
    return isBackground(rgb, i);
  };
  const seen = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x] || !light(x, y)) continue;
      const comp = [y * w + x];
      seen[y * w + x] = 1;
      let touches = false;
      for (let k = 0; k < comp.length; k++) {
        const cx = comp[k] % w,
          cy = (comp[k] / w) | 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const nx = cx + dx,
              ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (!out[(ny * w + nx) * 4 + 3]) touches = true;
            else if (
              Math.abs(dx) <= 1 &&
              Math.abs(dy) <= 1 &&
              !seen[ny * w + nx] &&
              light(nx, ny)
            ) {
              seen[ny * w + nx] = 1;
              comp.push(ny * w + nx);
            }
          }
      }
      if (touches && comp.length < 80) for (const p of comp) out[p * 4 + 3] = 0;
    }
}

// Crops the box to the pixels owned by `ids`, then trims to the opaque area.
function cut(sheet, labels, ids, box) {
  const { width, rgb } = sheet;
  const x0 = box.x0 - 1,
    y0 = box.y0 - 1;
  const w = box.x1 - box.x0 + 3,
    h = box.y1 - box.y0 + 3;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = x0 + x,
        sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= width || sy >= sheet.height) continue;
      const sp = sy * width + sx;
      if (!ids.has(labels[sp]) || sx < box.x0 || sx > box.x1) continue;
      const o = (y * w + x) * 4;
      out[o] = rgb[sp * 3];
      out[o + 1] = rgb[sp * 3 + 1];
      out[o + 2] = rgb[sp * 3 + 2];
      out[o + 3] = 255;
    }
  removeSpecks(out, w, h, rgb, sheet, x0, y0);
  let tx0 = w,
    ty0 = h,
    tx1 = -1,
    ty1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (out[(y * w + x) * 4 + 3]) {
        tx0 = Math.min(tx0, x);
        tx1 = Math.max(tx1, x);
        ty0 = Math.min(ty0, y);
        ty1 = Math.max(ty1, y);
      }
  const tw = tx1 - tx0 + 1,
    th = ty1 - ty0 + 1;
  const trimmed = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++)
    trimmed.set(
      out.subarray(((ty0 + y) * w + tx0) * 4, ((ty0 + y) * w + tx0 + tw) * 4),
      y * tw * 4,
    );
  return { w: tw, h: th, data: trimmed };
}

// Sprites that touch (long hair) form one blob: cut the row at the quietest columns instead.
function sliceRow(items, strays, cols, count) {
  const x0 = Math.min(...items.map((p) => p.x0));
  const x1 = Math.max(...items.map((p) => p.x1));
  const y0 = Math.min(...items.map((p) => p.y0));
  const y1 = Math.max(...items.map((p) => p.y1));
  const parts = [
    ...items,
    ...strays.filter((p) => p.y0 >= y0 - 10 && p.y1 <= y1 + 10),
  ];
  const pitch = (x1 - x0 + 1) / cols;
  const cuts = [x0];
  for (let i = 1; i < cols; i++) {
    let best = Math.round(x0 + i * pitch);
    for (let x = best - 20; x <= best + 20; x++)
      if (count(x, y0, y1) < count(best, y0, y1)) best = x;
    cuts.push(best);
  }
  cuts.push(x1 + 1);
  return cuts
    .slice(0, -1)
    .map((from, i) => ({ parts, x0: from, x1: cuts[i + 1] - 1, y0, y1 }));
}

function spriteRows(parts, cols, count) {
  const portraitLeft = Math.min(
    ...parts.filter((p) => p.y1 - p.y0 >= 300).map((p) => p.x0),
  );
  const cores = parts.filter(
    (p) =>
      p.area >= 250 && p.y1 - p.y0 < 300 && (p.x0 + p.x1) / 2 < portraitLeft,
  );
  const strays = parts.filter((p) => p.area < 250);
  const near = (a, b) =>
    Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1)) <= 12 &&
    Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1)) <= 12;
  const rows = [];
  for (const core of [...cores].sort((a, b) => a.y0 + a.y1 - b.y0 - b.y1)) {
    const cy = (core.y0 + core.y1) / 2;
    const row = rows.find((r) => Math.abs(r.cy - cy) < 80);
    if (row) {
      row.items.push(core);
      row.cy =
        row.items.reduce((s, p) => s + (p.y0 + p.y1) / 2, 0) / row.items.length;
    } else rows.push({ cy, items: [core] });
  }
  return rows.map((row) => {
    const groups = [];
    for (const core of row.items.sort((a, b) => a.x0 - b.x0)) {
      const last = groups.at(-1);
      if (last && core.x0 <= last.x1) {
        last.parts.push(core);
        last.x1 = Math.max(last.x1, core.x1);
        last.y0 = Math.min(last.y0, core.y0);
        last.y1 = Math.max(last.y1, core.y1);
      } else
        groups.push({
          parts: [core],
          x0: core.x0,
          x1: core.x1,
          y0: core.y0,
          y1: core.y1,
        });
    }
    if (groups.length < cols) return sliceRow(row.items, strays, cols, count);
    while (groups.length > cols) {
      let best = 0;
      for (let i = 1; i < groups.length - 1; i++)
        if (
          groups[i + 1].x0 - groups[i].x1 <
          groups[best + 1].x0 - groups[best].x1
        )
          best = i;
      const [a, b] = groups.splice(best, 2);
      groups.splice(best, 0, {
        parts: [...a.parts, ...b.parts],
        x0: a.x0,
        x1: Math.max(a.x1, b.x1),
        y0: Math.min(a.y0, b.y0),
        y1: Math.max(a.y1, b.y1),
      });
    }
    for (const stray of strays) {
      const owner = groups.find((g) => near(g, stray));
      if (!owner) continue;
      owner.parts.push(stray);
      owner.x0 = Math.min(owner.x0, stray.x0);
      owner.x1 = Math.max(owner.x1, stray.x1);
      owner.y0 = Math.min(owner.y0, stray.y0);
      owner.y1 = Math.max(owner.y1, stray.y1);
    }
    return groups;
  });
}

// Square head-and-shoulders crop from the top of a portrait, averaged down to size × size.
function faceSquare(portrait, size) {
  const side = Math.min(portrait.w, portrait.h);
  const left = (portrait.w - side) >> 1;
  const out = new Uint8Array(size * size * 4);
  const step = side / size;
  for (let oy = 0; oy < size; oy++)
    for (let ox = 0; ox < size; ox++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        n = 0;
      for (
        let y = Math.floor(oy * step);
        y < Math.max(Math.floor(oy * step) + 1, Math.floor((oy + 1) * step));
        y++
      )
        for (
          let x = Math.floor(ox * step);
          x < Math.max(Math.floor(ox * step) + 1, Math.floor((ox + 1) * step));
          x++
        ) {
          const i = (y * portrait.w + left + x) * 4;
          const alpha = portrait.data[i + 3];
          r += portrait.data[i] * alpha;
          g += portrait.data[i + 1] * alpha;
          b += portrait.data[i + 2] * alpha;
          a += alpha;
          n++;
        }
      const o = (oy * size + ox) * 4;
      if (a) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = a / n;
    }
  return out;
}

mkdirSync(OUT, { recursive: true });
const manifest = {};
for (const c of characters) {
  const sheet = decodePng(readFileSync(SRC + c.file));
  const bg = backgroundMask(sheet);
  const { labels, parts } = label(sheet, bg);
  const columnCount = (x, y0, y1) => {
    let n = 0;
    for (let y = y0; y <= y1; y++) if (!bg[y * sheet.width + x]) n++;
    return n;
  };
  const rows = spriteRows(parts, c.cols, columnCount);
  if (rows.length < 4 || rows.some((r) => r.length !== c.cols))
    throw new Error(`${c.id}: unexpected layout ${rows.map((r) => r.length)}`);
  const cutGroup = (g) =>
    cut(sheet, labels, new Set(g.parts.map((p) => p.id)), g);
  const down = rows[0].map(cutGroup);
  const side = rows[c.side].map(cutGroup);
  const up = rows[c.up].map(cutGroup);
  const all = [down, side, up];
  const cellW = Math.max(...all.flat().map((f) => f.w)) + 2;
  const cellH = Math.max(...all.flat().map((f) => f.h)) + 2;
  const cols = Math.max(...all.map((r) => r.length));
  const atlasW = cols * cellW;
  const atlasH = 3 * cellH;
  const atlas = new Uint8Array(atlasW * atlasH * 4);
  all.forEach((row, r) =>
    row.forEach((f, i) => {
      const ox = i * cellW + ((cellW - f.w) >> 1);
      const oy = r * cellH + (cellH - 1 - f.h);
      for (let y = 0; y < f.h; y++)
        atlas.set(
          f.data.subarray(y * f.w * 4, (y + 1) * f.w * 4),
          ((oy + y) * atlasW + ox) * 4,
        );
    }),
  );
  writeFileSync(`${OUT}${c.id}.png`, encodePng(atlasW, atlasH, atlas));
  const portraitPart = parts
    .filter((p) => p.y1 - p.y0 >= 300)
    .sort((a, b) => b.area - a.area)[0];
  const portrait = cut(sheet, labels, new Set([portraitPart.id]), portraitPart);
  writeFileSync(
    `${OUT}${c.id}-face.png`,
    encodePng(128, 128, faceSquare(portrait, 128)),
  );
  const heights = down.map((f) => f.h).sort((a, b) => a - b);
  manifest[c.id] = {
    frame: { width: cellW, height: cellH },
    columns: cols,
    scale:
      Math.round((TARGET_HEIGHT / heights[heights.length >> 1]) * 1000) / 1000,
    sideFacing: c.facing,
    frames: { down: down.length, side: side.length, up: up.length },
  };
  console.log(
    c.id,
    'rows',
    rows.map((r) => r.length).join('/'),
    JSON.stringify(manifest[c.id]),
  );
}
writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
