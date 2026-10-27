import Phaser from 'phaser';
import {
  doorCells,
  floorOf,
  props,
  walls,
  type Floor,
  type Prop,
  type Wall,
} from './layout';
import { T, drawProp, palette, rng, shade, type Light } from './props';

type G = Phaser.GameObjects.Graphics;
const columns = 96;
const rows = 64;
const floorKinds = new Set<Prop['kind']>([
  'rug',
  'prayerrug',
  'paving',
  'steps',
  'water',
]);

function floorCell(g: G, style: Floor, x: number, y: number) {
  const rand = rng(x * 131 + y * 17 + 7);
  const X = x * T;
  const Y = y * T;
  if (style === 'marble' || style === 'prayer') {
    const base = ((x >> 1) + (y >> 1)) % 2 ? 0xf4efe4 : 0xede7da;
    g.fillStyle(style === 'prayer' ? shade(base, 0.99) : base).fillRect(
      X,
      Y,
      T,
      T,
    );
    if (x % 2 === 0 && y % 2 === 0)
      g.lineStyle(1, 0xd3cab4, 0.75).strokeRect(X, Y, 2 * T, 2 * T);
    if (rand() < 0.14)
      g.lineStyle(1, 0xbfb49a, 0.22).lineBetween(
        X + rand() * T,
        Y,
        X + rand() * T,
        Y + T,
      );
    if (rand() < 0.05) g.fillStyle(0xffffff, 0.35).fillRect(X + 3, Y + 3, 5, 1);
  } else if (style === 'wood') {
    const c = y % 2 ? 0xd9b985 : 0xd1b07b;
    g.fillStyle(shade(c, 0.94 + rand() * 0.1)).fillRect(X, Y, T, T);
    g.fillStyle(0x7a5a37, 0.35).fillRect(X, Y + T - 1, T, 1);
    if (rand() < 0.3)
      g.fillStyle(0x7a5a37, 0.3).fillRect(
        X + Math.floor(rand() * T),
        Y,
        1,
        T - 1,
      );
  } else if (style === 'tile') {
    g.fillStyle((x + y) % 2 ? 0xe3edef : 0xd6e3e7).fillRect(X, Y, T, T);
    g.lineStyle(1, 0xb9ccd1, 0.6).strokeRect(X, Y, T, T);
  } else if (style === 'grass') {
    g.fillStyle(shade(0x68a448, 0.97 + rand() * 0.06)).fillRect(X, Y, T, T);
    for (let i = 0; i < 4; i++) {
      const bx = X + rand() * T;
      const by = Y + 3 + rand() * (T - 4);
      g.lineStyle(1, rand() > 0.5 ? 0x4c8a38 : 0x86c05a, 0.8).lineBetween(
        bx,
        by,
        bx + (rand() - 0.5) * 3,
        by - 3,
      );
    }
  } else if (style === 'deck') {
    g.fillStyle(shade(0xcc9f66, 0.93 + rand() * 0.12)).fillRect(X, Y, T, T);
    g.fillStyle(0x7a5a37, 0.35)
      .fillRect(X + 7, Y, 1, T)
      .fillRect(X + 15, Y, 1, T);
  } else {
    g.fillStyle(shade(0xdad3c3, 0.93 + rand() * 0.1)).fillRect(X, Y, T, T);
    g.fillStyle(0xb8ae98, 0.5).fillCircle(
      X + 4 + rand() * 8,
      Y + 4 + rand() * 8,
      2.2,
    );
  }
}

function floors(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(-100);
  for (let x = 0; x < columns; x++)
    for (let y = 0; y < rows; y++) {
      const style = floorOf(x, y);
      if (!style) continue;
      floorCell(g, style, x, y);
      if (doorCells.has(`${x},${y}`))
        g.fillStyle(0xe6d6a8, 0.55).fillRect(x * T, y * T, T, T);
    }
  for (const p of props.filter((q) => floorKinds.has(q.kind))) {
    const X = p.x * T,
      Y = p.y * T,
      W = p.w * T,
      H = p.h * T;
    if (p.kind === 'paving') {
      g.fillStyle(0xd7d0c0).fillRect(X, Y, W, H);
      g.lineStyle(1, 0xb9b09a, 0.6);
      for (let i = 0; i <= p.w; i += 2)
        g.lineBetween(X + i * T, Y, X + i * T, Y + H);
      for (let j = 0; j <= p.h; j += 2)
        g.lineBetween(X, Y + j * T, X + W, Y + j * T);
      g.lineStyle(2, 0x9a9078, 0.7).strokeRect(X, Y, W, H);
    } else if (p.kind === 'prayerrug') {
      g.fillStyle(0x2f6a4f).fillRect(X + 2, Y + 2, W - 4, H - 4);
      g.lineStyle(2, palette.gold).strokeRect(X + 3, Y + 3, W - 6, H - 6);
      g.lineStyle(1, 0xd9c283, 0.8).strokeRect(X + 7, Y + 7, W - 14, H - 14);
      g.fillStyle(0xd9c283, 0.8).fillRect(X + W / 2 - 1, Y + 9, 2, H - 18);
    } else if (p.kind === 'rug') {
      g.fillStyle(0x2b2418, 0.1).fillRoundedRect(X + 2, Y + 2, W, H, 6);
      g.fillStyle(0xe9dcc4).fillRoundedRect(X, Y, W, H, 6);
      g.lineStyle(2, 0xc9a24a, 0.9).strokeRoundedRect(
        X + 3,
        Y + 3,
        W - 6,
        H - 6,
        4,
      );
      g.lineStyle(1, 0xb9a47a, 0.7).strokeRoundedRect(
        X + 8,
        Y + 8,
        W - 16,
        H - 16,
        3,
      );
    } else if (p.kind === 'steps') {
      for (let j = 0; j < p.h; j++) {
        g.fillStyle(j % 2 ? 0xe6e0d2 : 0xd3ccbb).fillRect(X, Y + j * T, W, T);
        g.fillStyle(0xffffff, 0.45).fillRect(X, Y + j * T, W, 2);
      }
    }
  }
}

// Pool and spa water sit under everything and shimmer slowly.
function water(scene: Phaser.Scene) {
  const base = scene.add.graphics().setDepth(-99);
  const shimmer = scene.add.graphics().setDepth(-98);
  const rand = rng(99);
  for (const p of props.filter((q) => q.kind === 'water')) {
    const X = p.x * T,
      Y = p.y * T,
      W = p.w * T,
      H = p.h * T;
    base.fillStyle(0x2b2418, 0.14).fillRect(X - 1, Y - 1, W + 8, H + 8);
    base.fillStyle(0xf7f4ec).fillRoundedRect(X - 5, Y - 5, W + 10, H + 10, 6);
    base
      .fillGradientStyle(0x59cde6, 0x59cde6, 0x1d8fc4, 0x1d8fc4, 1, 1, 1, 1)
      .fillRoundedRect(X, Y, W, H, 4);
    base.lineStyle(1, 0xffffff, 0.35);
    for (let i = 0; i < W / 10; i++) {
      const lx = X + 6 + rand() * (W - 20);
      const ly = Y + 6 + rand() * (H - 12);
      shimmer
        .lineStyle(1.5, 0xffffff, 0.45)
        .lineBetween(lx, ly, lx + 6 + rand() * 8, ly + (rand() - 0.5) * 2);
    }
    for (let i = 0; i < 5; i++)
      base
        .fillStyle(0xffffff, 0.1)
        .fillEllipse(X + rand() * W, Y + rand() * H, 40, 10);
  }
  scene.tweens.add({
    targets: shimmer,
    alpha: { from: 0.25, to: 0.9 },
    x: { from: -3, to: 3 },
    duration: 2200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

type Look = { top: number; front: number; lift: number };
function look(w: Wall): Look {
  if (w.jamb) return { top: 0xe9d390, front: 0xc9a24a, lift: 30 };
  if (w.kind === 'hedge') return { top: 0x4a8f3f, front: 0x2f6a35, lift: 16 };
  if (w.kind === 'low') return { top: 0xdff1f4, front: 0xa9d4de, lift: 9 };
  return w.exterior
    ? { top: 0x6a7686, front: 0x434c5a, lift: 36 }
    : { top: 0xfbf9f4, front: 0xe6e0d2, lift: 30 };
}

function wallBlocks(scene: Phaser.Scene) {
  const cells = [...walls].map(([k, w]) => {
    const [x, y] = k.split(',').map(Number) as [number, number];
    return { x, y, w };
  });
  // One object per row run keeps the number of drawing objects small.
  cells.sort((a, b) => a.y - b.y || a.x - b.x);
  let run: typeof cells = [];
  const flush = () => {
    const first = run[0];
    if (!first) return;
    const g = scene.add.graphics().setDepth((first.y + 1) * T);
    const rand = rng(first.x * 17 + first.y);
    for (const { x, y, w } of run) {
      const { top, front, lift } = look(w);
      const hasFront = !walls.has(`${x},${y + 1}`);
      const X = x * T,
        Y = y * T;
      if (hasFront) {
        g.fillGradientStyle(
          shade(front, 1.12),
          shade(front, 1.12),
          shade(front, 0.88),
          shade(front, 0.88),
          1,
          1,
          1,
          1,
        ).fillRect(X, Y + T - lift, T, lift);
        if (w.kind === 'solid' && !w.exterior)
          g.fillStyle(palette.gold, 0.9).fillRect(X, Y + T - lift, T, 1);
        if (w.kind === 'solid' && w.exterior)
          g.fillStyle(0xcfe3ee, 0.55).fillRect(
            X + 3,
            Y + T - lift + 7,
            T - 6,
            12,
          );
        if (w.kind === 'hedge')
          for (let i = 0; i < 4; i++)
            g.fillStyle(0x6fb04f, 0.8).fillCircle(
              X + rand() * T,
              Y + T - lift + rand() * lift,
              1.6,
            );
        g.fillStyle(0x000000, 0.12).fillRect(X, Y + T - 1, T, 1);
      } else if (w.kind === 'hedge') {
        g.fillStyle(front).fillRect(X, Y + T - lift, T, lift);
      }
      g.fillStyle(top).fillRect(X, Y - lift, T, T);
      g.fillStyle(0xffffff, 0.3).fillRect(X, Y - lift, T, 1);
      if (w.kind === 'hedge')
        for (let i = 0; i < 3; i++)
          g.fillStyle(0x86c35a, 0.8).fillCircle(
            X + rand() * T,
            Y - lift + rand() * T,
            2,
          );
    }
    run = [];
  };
  for (const cell of cells) {
    const last = run.at(-1);
    const same =
      last &&
      last.y === cell.y &&
      last.x + 1 === cell.x &&
      look(last.w).lift === look(cell.w).lift;
    if (!same) flush();
    run.push(cell);
  }
  flush();
}

function lights(scene: Phaser.Scene, list: Light[]) {
  if (!scene.textures.exists('glow')) {
    const canvas = scene.textures.createCanvas('glow', 128, 128);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.28)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    canvas.refresh();
  }
  for (const l of list)
    scene.add
      .image(l.x, l.y, 'glow')
      .setTint(l.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.32)
      .setDisplaySize(l.size, l.size)
      .setDepth(9000);
}

function groundShadow(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(-101);
  g.fillStyle(0x3b2c22, 0.12);
  for (let x = 0; x < columns; x++)
    for (let y = 0; y < rows; y++)
      if (floorOf(x, y)) g.fillRect(x * T + 5, y * T + 9, T, T);
}

export function renderMap(scene: Phaser.Scene) {
  groundShadow(scene);
  floors(scene);
  water(scene);
  wallBlocks(scene);
  const list: Light[] = [];
  props.forEach((prop, index) => {
    if (floorKinds.has(prop.kind)) return;
    // Wall-mounted pieces share the wall's depth and are drawn just after it.
    const depth = (prop.y + prop.h) * T + (prop.onWall ? 0.2 : 0);
    const g = scene.add.graphics().setDepth(depth);
    drawProp({ scene, g, depth, lights: list }, prop, index * 977 + 13);
  });
  // The big lantern-lit corners of the pool.
  list.push(
    { x: 66 * T, y: 7 * T, color: 0x7ad4ff, size: 150 },
    { x: 80 * T, y: 7 * T, color: 0x7ad4ff, size: 150 },
  );
  lights(scene, list);
}
