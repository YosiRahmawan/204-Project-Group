import Phaser from 'phaser';
import akiraSheet from '../../../../Img/Karakter/Akira-General manager-Lead cordinator.png';
import mapImage from '../../../../Img/Map/Denah Kantor Mewah 204. Project Group.png';
import {
  findPath,
  toGrid,
  toScreen,
  isWalkable,
  mapHeight,
  mapWidth,
  type Cell,
} from './model';
import { spawn, roomAt, type Room } from './layout';

export type OfficeControls = {
  focus: (room: Room) => void;
  move: (goal: Cell) => void;
  zoom: (factor: number) => void;
  pan: (x: number, y: number) => void;
  reset: () => void;
  pause: (paused: boolean) => void;
  resize: (width: number, height: number) => void;
  destroy: () => void;
};

export function mountOffice(
  parent: HTMLElement,
  report: (message: string) => void,
  ready: () => void,
): OfficeControls {
  let paused = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  class OfficeScene extends Phaser.Scene {
    cell: Cell = { ...spawn };
    route: Cell[] = [];
    pending: Cell | null = null;
    progress = 0;
    avatar!: Phaser.GameObjects.Sprite;
    label!: Phaser.GameObjects.Text;
    shadow!: Phaser.GameObjects.Ellipse;
    marker!: Phaser.GameObjects.Graphics;
    elapsed = 0;
    loaded = false;
    dragging = false;
    pressedOnCanvas = false;
    down = { x: 0, y: 0 };

    constructor() {
      super('office-map');
    }
    preload() {
      this.load.image('map', mapImage);
      this.load.image('akira', akiraSheet);
    }
    create() {
      this.add.image(0, 0, 'map').setOrigin(0).setDepth(-100);
      this.marker = this.add.graphics().setDepth(0.5);
      const source = this.textures.exists('akira');
      if (source) {
        const texture = this.textures.get('akira');
        texture.add('idle', 0, 12, 145, 100, 200);
        for (let i = 0; i < 6; i++) {
          texture.add(`walk-right-${i}`, 0, 12 + i * 108, 365, 100, 192);
          texture.add(`walk-left-${i}`, 0, 12 + i * 108, 579, 100, 198);
        }
      }
      this.shadow = this.add.ellipse(0, 0, 30, 12, 0x514a3e, 0.16);
      this.avatar = this.add
        .sprite(
          0,
          0,
          source ? 'akira' : '__MISSING',
          source ? 'idle' : undefined,
        )
        .setOrigin(0.5, 1)
        .setScale(source ? 0.36 : 1);
      // Runtime blending suppresses the white reference-sheet background.
      // This is a reference preview, not a transparent production atlas.
      if (source) this.avatar.setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.label = this.add
        .text(0, 0, 'AKIRA', {
          fontFamily: 'Segoe UI',
          fontSize: '10px',
          color: '#443d35',
          backgroundColor: '#ffffff',
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5, 1);
      this.loaded = true;
      this.place(toScreen(this.cell));
      this.fit();
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.pressedOnCanvas = pointer.event.target === this.game.canvas;
        if (!this.pressedOnCanvas) return;
        this.down = { x: pointer.x, y: pointer.y };
        this.dragging = false;
      });
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (!this.pressedOnCanvas || !pointer.isDown || pointer.wasTouch)
          return;
        if (Math.hypot(pointer.x - this.down.x, pointer.y - this.down.y) > 6)
          this.dragging = true;
        if (this.dragging) {
          this.cameras.main.scrollX -=
            (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
          this.cameras.main.scrollY -=
            (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
        }
      });
      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (!this.pressedOnCanvas) return;
        this.pressedOnCanvas = false;
        if (pointer.event.target !== this.game.canvas) return;
        if (
          this.dragging ||
          Math.hypot(pointer.x - this.down.x, pointer.y - this.down.y) > 8
        )
          return;
        const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.go(toGrid(world));
      });
      ready();
      report(
        source
          ? 'Akira siap. Klik lantai atau pilih tujuan.'
          : 'Gambar Akira gagal dimuat. Penanda sementara digunakan; muat ulang untuk mencoba lagi.',
      );
    }
    fit() {
      if (!this.loaded) return;
      const camera = this.cameras.main;
      camera.setZoom(
        Math.min(camera.width / mapWidth, camera.height / mapHeight, 1),
      );
      camera.centerOn(mapWidth / 2, mapHeight / 2);
    }
    go(goal: Cell) {
      if (!this.loaded) return;
      if (!isWalkable(goal)) {
        report(
          'Tujuan terhalang dinding, furnitur, tanaman, air kolam, atau di luar kantor.',
        );
        return;
      }
      // Finish the current adjacent segment before rerouting; never cut a desk corner.
      if (this.progress > 0) {
        this.pending = goal;
        return;
      }
      this.route = findPath(this.cell, goal);
      if (
        !this.route.length &&
        (this.cell.x !== goal.x || this.cell.y !== goal.y)
      ) {
        report('Tujuan tidak memiliki jalur yang dapat dilalui.');
        return;
      }
      this.pending = null;
      const p = toScreen(goal);
      this.marker
        .clear()
        .lineStyle(2, 0x9a6b13)
        .strokeEllipse(p.x, p.y, 25, 12);
      const points = [this.cell, ...this.route].map(toScreen);
      this.marker.lineStyle(2, 0xb58a32, 0.65);
      for (let i = 1; i < points.length; i++)
        this.marker.lineBetween(
          points[i - 1]!.x,
          points[i - 1]!.y,
          points[i]!.x,
          points[i]!.y,
        );
      report(
        this.route.length
          ? `Akira menuju ${roomAt(goal)?.name ?? 'tujuan'} · petak ${goal.x + 1}, ${goal.y + 1}.`
          : `Akira di petak ${this.cell.x + 1}, ${this.cell.y + 1}.`,
      );
    }
    place(p: Cell) {
      this.avatar.setPosition(p.x, p.y + 3).setDepth(p.y + 2);
      this.shadow.setPosition(p.x, p.y + 1).setDepth(p.y);
      this.label.setPosition(p.x, p.y - 68).setDepth(1000);
    }
    update(_time: number, delta: number) {
      if (!this.loaded || paused || !this.route.length) return;
      if (reducedMotion.matches) {
        const goal = this.pending ?? this.route.at(-1)!;
        this.cell = goal;
        this.route = [];
        this.pending = null;
        this.progress = 0;
        if (this.textures.exists('akira')) this.avatar.setFrame('idle');
        this.place(toScreen(goal));
        report(
          `Akira tiba di ${roomAt(goal)?.name} · petak ${goal.x + 1}, ${goal.y + 1}.`,
        );
        return;
      }
      const target = this.route[0]!;
      this.progress = Math.min(1, this.progress + Math.min(delta, 50) / 90);
      this.elapsed += delta;
      const a = toScreen(this.cell),
        b = toScreen(target);
      this.place({
        x: a.x + (b.x - a.x) * this.progress,
        y: a.y + (b.y - a.y) * this.progress,
      });
      if (this.textures.exists('akira'))
        this.avatar.setFrame(
          `walk-${b.x >= a.x ? 'right' : 'left'}-${Math.floor(this.elapsed / 140) % 6}`,
        );
      if (this.progress === 1) {
        this.cell = target;
        this.route.shift();
        this.progress = 0;
        if (this.pending) this.go(this.pending);
        if (!this.route.length) {
          if (this.textures.exists('akira')) this.avatar.setFrame('idle');
          report(
            `Akira tiba di ${roomAt(this.cell)?.name} · petak ${this.cell.x + 1}, ${this.cell.y + 1}.`,
          );
        }
      }
    }
  }
  const scene = new OfficeScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: '#f2f0e9',
    scene,
    pixelArt: true,
    input: { mouse: { preventDefaultWheel: false }, touch: { capture: false } },
    banner: false,
    audio: { noAudio: true },
  });
  return {
    focus: (room) => {
      if (!scene.loaded) return;
      const camera = scene.cameras.main;
      camera.setZoom(
        Math.min(
          camera.width / (room.w + 80),
          camera.height / (room.h + 80),
          2,
        ),
      );
      camera.centerOn(room.x + room.w / 2, room.y + room.h / 2);
    },
    move: (goal) => scene.go(goal),
    zoom: (factor) => {
      if (scene.loaded)
        scene.cameras.main.setZoom(
          Phaser.Math.Clamp(scene.cameras.main.zoom * factor, 0.12, 2.5),
        );
    },
    pan: (x, y) => {
      if (scene.loaded) {
        scene.cameras.main.scrollX += x / scene.cameras.main.zoom;
        scene.cameras.main.scrollY += y / scene.cameras.main.zoom;
      }
    },
    reset: () => scene.fit(),
    pause: (value) => {
      paused = value;
    },
    resize: (width, height) => {
      if (width > 0 && height > 0) {
        game.scale.resize(width, height);
        scene.fit();
      }
    },
    destroy: () => game.destroy(true),
  };
}
