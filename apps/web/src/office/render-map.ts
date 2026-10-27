import Phaser from 'phaser';
import { rooms, props, walls, roomAt, type Prop } from './layout';
import { columns, rows, toScreen, type Cell } from './model';

export function renderMap(scene: Phaser.Scene) {
  const floor = scene.add.graphics().setDepth(-100);
  const polygon = (
    g: Phaser.GameObjects.Graphics,
    points: Cell[],
    color: number,
    alpha = 1,
  ) =>
    g.fillStyle(color, alpha).fillPoints(
      points.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
      true,
    );
  function corners(x: number, y: number, w: number, h: number, z = 0) {
    return [
      { x: x - 0.5, y: y - 0.5 },
      { x: x + w - 0.5, y: y - 0.5 },
      { x: x + w - 0.5, y: y + h - 0.5 },
      { x: x - 0.5, y: y + h - 0.5 },
    ].map((p) => {
      const q = toScreen(p);
      return { x: q.x, y: q.y - z };
    });
  }
  function block(p: Prop, z: number, top: number, side: number) {
    const bottom = corners(p.x, p.y, p.w, p.h),
      upper = corners(p.x, p.y, p.w, p.h, z);
    const g = scene.add
      .graphics()
      .setDepth(toScreen({ x: p.x + p.w - 1, y: p.y + p.h - 1 }).y + 1);
    polygon(g, [upper[1]!, upper[2]!, bottom[2]!, bottom[1]!], side);
    polygon(g, [upper[2]!, upper[3]!, bottom[3]!, bottom[2]!], side);
    polygon(g, upper, top);
    return g;
  }
  for (let x = 0; x < columns; x++)
    for (let y = 0; y < rows; y++) {
      const room = roomAt({ x, y })!;
      const color =
        room.id === 'garden' && (x === 10 || y === 5) ? 0xe9e5d8 : room.color;
      const tile = corners(x, y, 1, 1);
      polygon(floor, tile, color);
      floor
        .lineStyle(0.7, room.id === 'garden' ? 0xbacda6 : 0xd8d6cd, 0.65)
        .strokePoints(
          tile.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
          true,
        );
      if (room.id === 'workspace' && (x + y) % 7 === 0) {
        const p = toScreen({ x, y });
        floor
          .lineStyle(0.7, 0xd4d1c8, 0.5)
          .lineBetween(p.x - 14, p.y - 4, p.x + 10, p.y + 3);
      }
    }
  // Cutaway glass partitions keep the entire office and door gaps visible.
  for (const wall of walls) {
    const room = roomAt(wall)!;
    const outdoor = room.id === 'garden' || room.id === 'pool';
    const height = outdoor ? 10 : 30;
    const g = block(
      { ...wall, w: 1, h: 1, kind: 'bench' },
      height,
      outdoor ? 0xe1dfd1 : 0xdce9e7,
      outdoor ? 0xc5c2af : 0xc5d4d1,
    );
    g.setAlpha(outdoor ? 1 : 0.65);
    const cap = corners(wall.x, wall.y, 1, 1, height);
    g.lineStyle(1.5, 0xb29c68).strokePoints(
      cap.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
      true,
    );
  }
  props.forEach((p) => {
    const center = toScreen({ x: p.x + (p.w - 1) / 2, y: p.y + (p.h - 1) / 2 });
    const depth = toScreen({ x: p.x + p.w - 1, y: p.y + p.h - 1 }).y + 2;
    if (p.kind === 'plant') {
      const g = block(p, 12, 0xf4f0e5, 0xc7c1ac);
      const garden = roomAt(p)?.id === 'garden';
      const height = garden ? 70 : 44;
      g.lineStyle(5, 0x756e47).lineBetween(
        center.x,
        center.y - 12,
        center.x,
        center.y - height,
      );
      g.fillStyle(0x426448)
        .fillEllipse(center.x - 12, center.y - height + 10, 37, 25)
        .fillEllipse(center.x + 14, center.y - height + 4, 34, 25);
      g.fillStyle(0x5d7e50).fillEllipse(
        center.x,
        center.y - height - 10,
        38,
        29,
      );
      return;
    }
    if (p.kind === 'water') {
      polygon(floor, corners(p.x, p.y, p.w, p.h), 0x50aebc);
      for (let x = p.x; x < p.x + p.w; x++)
        for (let y = p.y; y < p.y + p.h; y++) {
          const q = toScreen({ x, y });
          floor
            .lineStyle(1, 0xc6f0ef, 0.65)
            .lineBetween(q.x - 13, q.y, q.x + 8, q.y + 4);
        }
      const rim = corners(p.x, p.y, p.w, p.h);
      floor.lineStyle(5, 0xffffff).strokePoints(
        rim.map((q) => new Phaser.Math.Vector2(q.x, q.y)),
        true,
      );
      return;
    }
    if (p.kind === 'rug') {
      polygon(floor, corners(p.x, p.y, 1, 1), 0x53775b);
      floor.lineStyle(2, 0xb9a363).strokePoints(
        corners(p.x + 0.1, p.y + 0.1, 0.8, 0.8).map(
          (q) => new Phaser.Math.Vector2(q.x, q.y),
        ),
        true,
      );
      return;
    }
    const sofa =
      p.kind === 'sofa' || p.kind === 'lounger' || p.kind === 'chair';
    const height =
      p.kind === 'monitor' ? 42 : p.kind === 'reception' ? 36 : sofa ? 20 : 24;
    const g = block(
      p,
      height,
      p.kind === 'bench' ? 0xa58b61 : sofa ? 0xe3d8c4 : 0xfffdf7,
      p.kind === 'bench' ? 0x7c6b4c : 0xc9c2ae,
    );
    if (sofa) {
      const back = corners(p.x, p.y, p.w, 0.22, height + 15);
      polygon(g, back, 0xf8f2e6);
      for (let i = 0; i < p.w; i++) {
        const q = toScreen({ x: p.x + i, y: p.y });
        g.lineStyle(1, 0xbbae96).lineBetween(
          q.x - 14,
          q.y - height,
          q.x + 9,
          q.y - height + 10,
        );
      }
    }
    if (p.kind === 'desk' || p.kind === 'monitor') {
      const count = p.kind === 'monitor' ? p.w : 1;
      for (let i = 0; i < count; i++) {
        const q = toScreen({ x: p.x + i, y: p.y });
        g.fillStyle(0x273d3e).fillRoundedRect(
          q.x - 13,
          q.y - height - 28,
          30,
          24,
          2,
        );
        g.fillStyle(0x7eb7b7).fillRect(q.x - 10, q.y - height - 25, 24, 16);
        g.lineStyle(2, 0xc3e3d7).lineBetween(
          q.x - 7,
          q.y - height - 17,
          q.x + 9,
          q.y - height - 17,
        );
        g.lineStyle(3, 0x7d8379).lineBetween(
          q.x + 2,
          q.y - height - 4,
          q.x + 2,
          q.y - height + 2,
        );
      }
    }
    if (p.kind === 'table') {
      g.fillStyle(0xb69a60).fillEllipse(center.x, center.y - height, 17, 10);
    }
    if (p.label)
      scene.add
        .text(center.x, center.y - height + 3, p.label, {
          fontFamily: 'Segoe UI',
          fontSize: p.kind === 'reception' ? '11px' : '8px',
          color: '#645637',
        })
        .setOrigin(0.5)
        .setDepth(depth + 1);
  });
  rooms.forEach((room, index) => {
    const p = toScreen({ x: room.x + room.w / 2, y: room.y + 1 });
    scene.add
      .text(
        p.x,
        p.y - 35,
        `${String(index + 1).padStart(2, '0')}  ${room.name.toUpperCase()}`,
        {
          fontFamily: 'Segoe UI',
          fontSize: '17px',
          fontStyle: 'bold',
          color: '#fff5d9',
          backgroundColor: '#292e29',
          padding: { x: 12, y: 7 },
        },
      )
      .setOrigin(0.5)
      .setDepth(2000);
  });
}
