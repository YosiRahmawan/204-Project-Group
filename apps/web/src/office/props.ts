import Phaser from 'phaser';
import type { Prop } from './layout';

export const T = 16;
export type Light = { x: number; y: number; color: number; size: number };
export type Ctx = {
  scene: Phaser.Scene;
  g: Phaser.GameObjects.Graphics;
  depth: number;
  lights: Light[];
};
type G = Phaser.GameObjects.Graphics;

export const palette = {
  gold: 0xc9a24a,
  goldDark: 0x9a6b13,
  white: 0xfbf9f3,
  cream: 0xf0eadc,
  wood: 0xb98d58,
  woodDark: 0x8c6a3f,
  slate: 0x4a5565,
  ink: 0x1b1a19,
  leaf: [0x2f6b34, 0x4a8a3a, 0x7fb04a] as const,
  glass: 0x9ed3df,
};

export const outline = 0x3b2c22;

export function shade(color: number, factor: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((color & 255) * factor));
  return (r << 16) | (g << 8) | b;
}

// Small deterministic random numbers, so the office looks the same on every load.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An upright block seen from the south: footprint (x, y, w, h) raised by `lift`.
export function box(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  lift: number,
  top: number,
  front = shade(top, 0.82),
) {
  g.fillStyle(0x2b2418, 0.13).fillRect(x + 3, y + 3, w, h);
  g.fillStyle(front).fillRect(x, y + h - lift, w, lift);
  g.fillStyle(top).fillRect(x, y - lift, w, h);
  g.fillStyle(0xffffff, 0.28).fillRect(x, y - lift, w, 1);
  g.lineStyle(1, outline, 0.5).strokeRect(
    x + 0.5,
    y - lift + 0.5,
    w - 1,
    h + lift - 1,
  );
}

// Same idea for rounded shapes: stack the outline upward.
function roundedBlock(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  lift: number,
  radius: number,
  top: number,
  front: number,
) {
  g.fillStyle(0x2b2418, 0.13).fillRoundedRect(x + 3, y + 3, w, h, radius);
  for (let s = 0; s < lift; s += 2)
    g.fillStyle(front).fillRoundedRect(x, y - s, w, h, radius);
  g.fillStyle(top).fillRoundedRect(x, y - lift, w, h, radius);
  g.lineStyle(1, outline, 0.5).strokeRoundedRect(
    x + 0.5,
    y - lift + 0.5,
    w - 1,
    h - 1,
    radius,
  );
}

function foliage(
  g: G,
  cx: number,
  cy: number,
  r: number,
  rand: () => number,
  colors: readonly number[],
  count: number,
) {
  const dark = colors[0]!,
    mid = colors[1]!,
    light = colors[2]!;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * r * 0.7;
    g.fillStyle(dark).fillCircle(
      cx + Math.cos(a) * d,
      cy + Math.sin(a) * d * 0.8 + r * 0.12,
      r * (0.3 + rand() * 0.22),
    );
  }
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * r * 0.6;
    g.fillStyle(mid).fillCircle(
      cx + Math.cos(a) * d,
      cy + Math.sin(a) * d * 0.8 - r * 0.05,
      r * (0.26 + rand() * 0.2),
    );
  }
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * r * 0.5;
    g.fillStyle(light, 0.9).fillCircle(
      cx + Math.cos(a) * d - r * 0.12,
      cy + Math.sin(a) * d * 0.7 - r * 0.22,
      r * (0.14 + rand() * 0.14),
    );
  }
}

function leaves(
  g: G,
  cx: number,
  baseY: number,
  length: number,
  count: number,
  rand: () => number,
  colors: readonly number[],
) {
  for (let i = 0; i < count; i++) {
    const a =
      -Math.PI / 2 + (i / (count - 1) - 0.5) * 2.3 + (rand() - 0.5) * 0.2;
    const tipX = cx + Math.cos(a) * length;
    const tipY = baseY + Math.sin(a) * length * 0.9;
    const mx = cx + Math.cos(a + 0.5) * length * 0.35;
    const my = baseY + Math.sin(a + 0.5) * length * 0.3;
    g.fillStyle(colors[i % 2 === 0 ? 1 : 0]!).fillTriangle(
      cx,
      baseY,
      tipX,
      tipY,
      mx,
      my,
    );
    g.fillStyle(colors[2]!, 0.6).fillTriangle(
      cx,
      baseY,
      tipX,
      tipY,
      cx + Math.cos(a - 0.4) * length * 0.4,
      baseY + Math.sin(a - 0.4) * length * 0.35,
    );
  }
}

function monitor(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  tint: number,
) {
  g.fillStyle(0x23292d).fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 2);
  g.fillGradientStyle(
    shade(tint, 1.25),
    shade(tint, 1.25),
    shade(tint, 0.7),
    shade(tint, 0.7),
    1,
    1,
    1,
    1,
  ).fillRect(x, y, w, h);
  g.fillStyle(0xffffff, 0.5).fillRect(x + 2, y + 2, w * 0.55, 1);
  g.fillStyle(0xffffff, 0.3).fillRect(x + 2, y + 5, w * 0.35, 1);
}

function chair(g: G, cx: number, y: number, color = 0x6b6358) {
  g.fillStyle(0x2b2418, 0.15).fillEllipse(cx, y + 12, 18, 7);
  g.fillStyle(shade(color, 0.7)).fillRoundedRect(cx - 8, y + 2, 16, 7, 2);
  g.fillStyle(color).fillRoundedRect(cx - 8, y + 6, 16, 9, 3);
  g.fillStyle(0xffffff, 0.15).fillRect(cx - 6, y + 7, 12, 1);
}

type Draw = (ctx: Ctx, p: Prop, rand: () => number) => void;
const px = (p: Prop) => p.x * T;
const py = (p: Prop) => p.y * T;
const pw = (p: Prop) => p.w * T;
const ph = (p: Prop) => p.h * T;

const draw: Partial<Record<Prop['kind'], Draw>> = {
  workstations({ g }, p, rand) {
    for (let i = 0; i < 2; i++) {
      const dx = px(p) + i * 64;
      const y = py(p);
      box(g, dx + 2, y, 60, 28, 12, 0xfffdf8, 0xd8d1c0);
      g.fillStyle(0xe9e2d1).fillRect(dx + 2, y + 18 - 12, 60, 2);
      monitor(g, dx + 8, y - 34, 20, 15, 0x4f9db3);
      monitor(g, dx + 34, y - 34, 20, 15, rand() > 0.5 ? 0x5a8fc4 : 0x4f9db3);
      g.fillStyle(0x6f6a60)
        .fillRect(dx + 16, y - 20, 4, 8)
        .fillRect(dx + 42, y - 20, 4, 8);
      g.fillStyle(0xcfc9bb).fillRoundedRect(dx + 14, y - 8, 24, 6, 1);
      g.fillStyle(0xb89a5a).fillCircle(dx + 52, y - 9, 3);
      chair(g, dx + 32, y + 32);
    }
  },
  planter({ g }, p, rand) {
    const cx = px(p) + pw(p) / 2;
    box(g, px(p) + 2, py(p) + 8, pw(p) - 4, 22, 10, 0xf2ecdd, 0xc9bfa6);
    g.fillStyle(0x4a3a2a).fillRect(px(p) + 4, py(p) + 8 - 10, pw(p) - 8, 6);
    leaves(g, cx, py(p) + 4, 36, 9, rand, palette.leaf);
    foliage(g, cx, py(p) - 22, 18, rand, palette.leaf, 7);
  },
  plant({ g }, p, rand) {
    const cx = px(p) + 8;
    g.fillStyle(0x2b2418, 0.14).fillEllipse(cx + 2, py(p) + 14, 16, 6);
    g.fillStyle(0x8f6b48).fillRect(cx - 5, py(p) + 4, 10, 10);
    g.fillStyle(0xad8660).fillRect(cx - 6, py(p) + 2, 12, 3);
    leaves(g, cx, py(p) + 3, 26, 7, rand, palette.leaf);
    foliage(g, cx, py(p) - 12, 11, rand, palette.leaf, 4);
  },
  meeting({ g }, p) {
    const tx = px(p) + 12;
    const ty = py(p) + 14;
    const tw = pw(p) - 24;
    const th = ph(p) - 28;
    for (let x = tx + 6; x < tx + tw - 10; x += 22) {
      chair(g, x + 8, py(p) - 6, 0x8a8174);
      chair(g, x + 8, py(p) + ph(p) - 12, 0x8a8174);
    }
    roundedBlock(g, tx, ty, tw, th, 12, 6, 0xf8f1e3, 0xc9bda4);
    g.lineStyle(1.5, palette.gold, 0.9).strokeRoundedRect(
      tx + 2,
      ty - 10,
      tw - 4,
      th - 4,
      5,
    );
    for (let x = tx + 18; x < tx + tw - 14; x += 34) {
      g.fillStyle(0xd9d2c2).fillRoundedRect(x, ty - 8, 12, 8, 1);
      g.fillStyle(0x2b2a28).fillRect(x + 2, ty - 6, 8, 4);
    }
  },
  reception(ctx, p) {
    const { g } = ctx;
    roundedBlock(g, px(p), py(p) + 6, pw(p), 30, 18, 14, 0xfbfaf6, 0xddd6c6);
    g.lineStyle(2, palette.gold, 0.9).strokeRoundedRect(
      px(p) + 3,
      py(p) + 6 - 18 + 3,
      pw(p) - 6,
      24,
      12,
    );
    g.fillStyle(palette.gold, 0.85).fillRect(
      px(p) + 18,
      py(p) + 36 - 18,
      pw(p) - 36,
      2,
    );
    monitor(g, px(p) + 56, py(p) - 26, 22, 14, 0x4f9db3);
    monitor(g, px(p) + 84, py(p) - 26, 22, 14, 0x5a8fc4);
    ctx.lights.push({
      x: px(p) + pw(p) / 2,
      y: py(p) + 30,
      color: 0xffd98a,
      size: 140,
    });
  },
  signwall(ctx, p) {
    const { g, scene, depth } = ctx;
    const x = px(p),
      y = py(p),
      w = pw(p);
    box(g, x, y, w, T, 46, 0x2a2623, 0x15120f);
    const fy = y + T - 46;
    g.lineStyle(2, palette.gold).strokeRect(x + 4, fy + 4, w - 8, 38);
    g.lineStyle(1, palette.gold, 0.5).strokeRect(x + 8, fy + 8, w - 16, 30);
    scene.add
      .text(x + w / 2, fy + 19, '204.', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#d9b866',
        resolution: 3,
      })
      .setOrigin(0.5)
      .setDepth(depth + 0.1);
    scene.add
      .text(x + w / 2, fy + 34, 'PROJECT GROUP', {
        fontFamily: 'Segoe UI',
        fontSize: '7px',
        color: '#e8dcc0',
        resolution: 3,
      })
      .setOrigin(0.5)
      .setDepth(depth + 0.1);
    ctx.lights.push({ x: x + w / 2, y: fy + 20, color: 0xffd98a, size: 160 });
  },
  screenwall(ctx, p, rand) {
    const { g } = ctx;
    const x = px(p),
      y = py(p),
      w = pw(p);
    box(g, x, y, w, T, 42, 0xd8d2c3, 0x2c3238);
    const fy = y + T - 42;
    g.fillGradientStyle(
      0x14304a,
      0x14304a,
      0x0a1620,
      0x0a1620,
      1,
      1,
      1,
      1,
    ).fillRect(x + 6, fy + 5, w - 12, 32);
    for (let i = 0; i < 9; i++) {
      const bw = (w - 28) / 9;
      const bh = 6 + rand() * 20;
      g.fillStyle(0x5fc0d6, 0.85).fillRect(
        x + 10 + i * bw,
        fy + 35 - bh,
        bw - 3,
        bh,
      );
    }
    g.lineStyle(1, 0xf0d890, 0.8).strokeRect(x + 6, fy + 5, w - 12, 32);
    g.fillStyle(0xf0d890)
      .fillRect(x + w - 40, fy + 9, 26, 2)
      .fillRect(x + w - 40, fy + 14, 18, 2);
    ctx.lights.push({ x: x + w / 2, y: fy + 20, color: 0x7ad4ff, size: 150 });
  },
  sofa({ g }, p) {
    const x = px(p),
      y = py(p),
      w = pw(p),
      h = ph(p);
    const dir = p.dir ?? 'n';
    box(g, x, y, w, h, 9, 0xe8dfcd, 0xcfc3ab);
    if (dir === 'n') {
      box(g, x, y, w, 9, 22, 0xf3ebdb, 0xd9cdb5);
      for (let cx = x + 32; cx < x + w - 8; cx += 32)
        g.fillStyle(0xb8ab92, 0.6).fillRect(cx, y - 13, 1, 16);
      box(g, x, y, 7, h, 18, 0xf0e7d6, 0xd2c6ae);
      box(g, x + w - 7, y, 7, h, 18, 0xf0e7d6, 0xd2c6ae);
    } else if (dir === 'e') {
      box(g, x + w - 9, y, 9, h, 22, 0xf3ebdb, 0xd9cdb5);
      box(g, x, y, w, 7, 18, 0xf0e7d6, 0xd2c6ae);
    } else if (dir === 'w') {
      box(g, x, y, 9, h, 22, 0xf3ebdb, 0xd9cdb5);
      box(g, x, y, w, 7, 18, 0xf0e7d6, 0xd2c6ae);
    } else {
      box(g, x, y + h - 9, w, 9, 22, 0xf3ebdb, 0xd9cdb5);
      box(g, x, y, 7, h, 18, 0xf0e7d6, 0xd2c6ae);
    }
  },
  armchair({ g }, p) {
    const x = px(p),
      y = py(p),
      w = pw(p),
      h = ph(p);
    box(g, x + 2, y + 2, w - 4, h - 4, 9, 0xe3d9c6, 0xcbbfa6);
    box(g, x + 2, y + 2, w - 4, 8, 22, 0xf0e8d8, 0xd5c9b1);
  },
  table({ g }, p) {
    const cx = px(p) + pw(p) / 2,
      cy = py(p) + ph(p) / 2;
    g.fillStyle(0x2b2418, 0.15).fillEllipse(cx + 3, cy + 6, 30, 14);
    g.fillStyle(0x8c6a3f).fillRect(cx - 3, cy - 8, 6, 14);
    g.fillStyle(0xd8ceb6).fillEllipse(cx, cy - 11, 30, 15);
    g.fillStyle(0xfbf8f0).fillEllipse(cx, cy - 14, 30, 15);
    g.lineStyle(1.5, palette.gold).strokeEllipse(cx, cy - 14, 30, 15);
    g.fillStyle(palette.gold)
      .fillRect(cx - 2, cy - 21, 4, 6)
      .fillCircle(cx, cy - 22, 3);
  },
  tree({ g }, p, rand) {
    const cx = px(p) + 8,
      base = py(p) + 14;
    g.fillStyle(0x24351f, 0.22).fillEllipse(cx + 6, base + 1, 46, 14);
    g.fillStyle(0x6d4f33).fillRect(cx - 3, base - 30, 6, 30);
    g.fillStyle(0x84603d).fillRect(cx - 3, base - 30, 2, 30);
    foliage(g, cx, base - 52, 28, rand, palette.leaf, 11);
  },
  bigtree({ g }, p, rand) {
    const cx = px(p) + 16,
      base = py(p) + 30;
    g.fillStyle(0x24351f, 0.22).fillEllipse(cx + 10, base + 2, 120, 34);
    g.fillStyle(0x6d4f33).fillRect(cx - 7, base - 46, 14, 46);
    g.fillStyle(0x84603d).fillRect(cx - 7, base - 46, 4, 46);
    g.fillStyle(0x6d4f33)
      .fillTriangle(cx - 14, base, cx - 5, base - 20, cx + 2, base)
      .fillTriangle(cx + 14, base, cx + 5, base - 20, cx - 2, base);
    foliage(g, cx, base - 88, 54, rand, palette.leaf, 22);
  },
  blossom({ g }, p, rand) {
    const cx = px(p) + 8,
      base = py(p) + 14;
    g.fillStyle(0x24351f, 0.22).fillEllipse(cx + 6, base + 1, 48, 14);
    g.fillStyle(0x6d4f33).fillRect(cx - 3, base - 34, 6, 34);
    foliage(g, cx, base - 56, 30, rand, [0xc97b9a, 0xe79cb8, 0xf7c9d8], 12);
  },
  palm({ g }, p, rand) {
    const cx = px(p) + 8,
      base = py(p) + 14;
    g.fillStyle(0x24351f, 0.2).fillEllipse(cx + 4, base + 1, 36, 11);
    g.lineStyle(5, 0x7a5a3a)
      .lineBetween(cx, base, cx + 3, base - 24)
      .lineBetween(cx + 3, base - 24, cx + 1, base - 44);
    leaves(g, cx + 1, base - 44, 30, 9, rand, palette.leaf);
  },
  bench({ g }, p) {
    const x = px(p),
      y = py(p),
      w = pw(p);
    box(g, x + 2, y + 6, w - 4, 8, 9, 0xb98d58, 0x8c6a3f);
    box(g, x + 2, y + 4, w - 4, 3, 20, 0xc59a63, 0x8c6a3f);
  },
  lamp(ctx, p) {
    const { g } = ctx;
    const cx = px(p) + 8,
      base = py(p) + 14;
    g.fillStyle(0x2b2418, 0.2).fillEllipse(cx + 2, base, 14, 5);
    g.fillStyle(0x3a3631)
      .fillRect(cx - 1, base - 36, 3, 36)
      .fillRect(cx - 4, base - 2, 9, 3);
    g.fillStyle(0xfff0b8).fillRoundedRect(cx - 4, base - 46, 9, 12, 2);
    g.lineStyle(1, palette.goldDark).strokeRoundedRect(
      cx - 4,
      base - 46,
      9,
      12,
      2,
    );
    ctx.lights.push({ x: cx, y: base - 40, color: 0xffd98a, size: 80 });
  },
  shelf({ g }, p, rand) {
    const x = px(p),
      y = py(p),
      w = pw(p),
      h = ph(p);
    box(g, x, y, w, h, 46, 0xa87f4e, 0x7a5a37);
    const horizontal = w >= h;
    for (let i = 0; i < (horizontal ? w : h) / 4; i++) {
      const c = [0x9c3d3d, 0x3d6a9c, 0x4f8a5a, 0xd9b45a, 0xe8e0d0][
        Math.floor(rand() * 5)
      ]!;
      g.fillStyle(c).fillRect(
        horizontal ? x + 2 + i * 4 : x + 3,
        horizontal ? y - 44 + 6 : y - 46 + 3 + i * 4,
        horizontal ? 3 : w - 6,
        horizontal ? 10 : 3,
      );
    }
  },
  counter({ g }, p) {
    const x = px(p),
      y = py(p),
      w = pw(p),
      h = ph(p);
    box(g, x, y, w, h, 18, 0xf8f6f0, 0xb99560);
    g.lineStyle(1, 0x8c6a3f, 0.5);
    for (let cx = x + 16; cx < x + w; cx += 16)
      g.lineBetween(cx, y + h - 18, cx, y + h);
    g.lineStyle(1.5, palette.gold, 0.9).lineBetween(
      x,
      y + h - 18,
      x + w,
      y + h - 18,
    );
    g.lineStyle(1, 0xd9d2c2).lineBetween(x + 4, y - 14, x + w - 4, y - 14);
  },
  stools({ g }, p) {
    for (let i = 0; i < p.w; i += 2) {
      const cx = px(p) + i * T + 16;
      g.fillStyle(0x2b2418, 0.14).fillEllipse(cx + 2, py(p) + 14, 14, 5);
      g.fillStyle(0x6d6459).fillRect(cx - 1, py(p) + 3, 3, 11);
      g.fillStyle(palette.gold).fillEllipse(cx, py(p) + 3, 14, 7);
      g.fillStyle(0xe9d9a8).fillEllipse(cx, py(p) + 2, 12, 5);
    }
  },
  console(ctx, p, rand) {
    const { g } = ctx;
    const x = px(p),
      y = py(p),
      w = pw(p);
    roundedBlock(g, x, y + 14, w, 46, 14, 22, 0xf7f5ef, 0xc9d2d8);
    g.lineStyle(2, 0x6bb6d0, 0.9).strokeRoundedRect(
      x + 4,
      y + 14 - 14 + 4,
      w - 8,
      38,
      18,
    );
    for (let i = 0; i < 6; i++)
      monitor(
        g,
        x + 24 + i * 38,
        y - 8,
        28,
        17,
        rand() > 0.5 ? 0x4f9db3 : 0x5a8fc4,
      );
    chair(g, x + w / 2, y + 52, 0x3a3f46);
    ctx.lights.push({ x: x + w / 2, y: y, color: 0x7ad4ff, size: 170 });
  },
  mihrab(ctx, p) {
    const { g } = ctx;
    const x = px(p),
      y = py(p),
      w = pw(p);
    box(g, x, y, w, T, 46, 0xe9dfc8, 0xd8ccb0);
    const fy = y + T - 46;
    const cx = x + w / 2;
    g.fillStyle(palette.gold).fillRoundedRect(cx - 22, fy + 3, 44, 42, {
      tl: 22,
      tr: 22,
      bl: 0,
      br: 0,
    });
    g.fillStyle(0x1e4a42).fillRoundedRect(cx - 18, fy + 8, 36, 37, {
      tl: 18,
      tr: 18,
      bl: 0,
      br: 0,
    });
    g.lineStyle(1, 0xe7d08a, 0.8).strokeRoundedRect(cx - 12, fy + 14, 24, 31, {
      tl: 12,
      tr: 12,
      bl: 0,
      br: 0,
    });
    g.fillStyle(0xe7d08a).fillCircle(cx, fy + 24, 3);
    ctx.lights.push({ x: cx, y: fy + 26, color: 0xffd98a, size: 110 });
  },
  lounger({ g }, p) {
    const x = px(p),
      y = py(p),
      w = pw(p);
    box(g, x + 2, y + 2, w - 4, 12, 7, 0xf6f1e6, 0xd3cab4);
    box(g, x + 2, y + 1, 10, 6, 16, 0xf6f1e6, 0xd3cab4);
    g.fillStyle(0x5aa6c4, 0.8).fillRect(x + 14, y - 5, w - 22, 3);
  },
  umbrella({ g }, p) {
    const cx = px(p) + 8,
      base = py(p) + 14;
    g.fillStyle(0x24351f, 0.18).fillEllipse(cx + 12, base + 2, 70, 22);
    g.fillStyle(0xb7a98a).fillRect(cx - 1, base - 60, 3, 60);
    g.fillStyle(0xe4d8bd).fillEllipse(cx, base - 62, 74, 26);
    g.fillStyle(0xfbf5e6).fillEllipse(cx, base - 66, 74, 26);
    g.lineStyle(1, 0xcdbf9f, 0.9);
    for (let i = -3; i <= 3; i++)
      g.lineBetween(cx, base - 70, cx + i * 11, base - 62 + Math.abs(i));
    g.fillStyle(palette.gold).fillCircle(cx, base - 71, 2);
  },
  hedge({ g }, p, rand) {
    const x = px(p),
      y = py(p),
      w = pw(p);
    box(g, x, y + 2, w, 12, 12, 0x3f7d3b, 0x2c5f2f);
    for (let i = 0; i < w / 3; i++) {
      const c = [0xf4b6cc, 0xffffff, 0xf6d86a][Math.floor(rand() * 3)]!;
      g.fillStyle(c).fillCircle(
        x + 2 + rand() * (w - 4),
        y - 8 + rand() * 12,
        1.4,
      );
    }
  },
};

export function drawProp(ctx: Ctx, p: Prop, seed: number) {
  draw[p.kind]?.(ctx, p, rng(seed));
}
