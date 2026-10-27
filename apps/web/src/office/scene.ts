import Phaser from 'phaser';
import mapImage from '../../../../assets/runtime/maps/office.png';
import { characters, spriteInfo, type Character } from './characters';
import { mapHeight, mapWidth, toGrid, toScreen, type Cell } from './model';
import { occluders, roomAt, spawn, type Room } from './layout';
import {
  advance,
  goTo,
  heading,
  newWalker,
  snapToGoal,
  walkerPoint,
  type Heading,
  type Walker,
} from './walker';

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

type Actor = {
  character: Character;
  walker: Walker;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  facing: Heading;
  elapsed: number;
};

// Sprite sheet rows: 0 = facing down, 1 = sideways, 2 = facing up.
const rowOf = { down: 0, left: 1, right: 1, up: 2 } as const;
const controlled = 'akira';

export function mountOffice(
  parent: HTMLElement,
  report: (message: string) => void,
  ready: () => void,
): OfficeControls {
  let paused = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  class OfficeScene extends Phaser.Scene {
    actors: Actor[] = [];
    marker!: Phaser.GameObjects.Graphics;
    loaded = false;
    dragging = false;
    pressedOnCanvas = false;
    down = { x: 0, y: 0 };

    constructor() {
      super('office-map');
    }
    preload() {
      this.load.image('map', mapImage);
      for (const c of characters) {
        const { frame } = spriteInfo[c.id];
        this.load.spritesheet(c.id, c.url, {
          frameWidth: frame.width,
          frameHeight: frame.height,
        });
      }
    }
    create() {
      this.add.image(0, 0, 'map').setOrigin(0).setDepth(-100);
      // The same map, cropped around each tall object and sorted by its front edge,
      // so a character standing behind furniture is drawn under it.
      for (const [x, y, w, h] of occluders)
        this.add
          .image(0, 0, 'map')
          .setOrigin(0)
          .setCrop(x, y, w, h)
          .setDepth(y + h);
      this.marker = this.add.graphics().setDepth(0.5);
      this.actors = characters.map((c) => this.addActor(c));
      this.loaded = true;
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
        this.textures.exists(controlled)
          ? 'Akira siap. Klik lantai atau pilih tujuan.'
          : 'Gambar karakter gagal dimuat; muat ulang untuk mencoba lagi.',
      );
    }
    addActor(character: Character): Actor {
      const info = spriteInfo[character.id];
      const home = toGrid(character.home);
      const cell = character.id === controlled ? { ...spawn } : home;
      const walker = newWalker(cell);
      const scale = info.scale;
      const shadow = this.add.ellipse(0, 0, 30, 12, 0x514a3e, 0.16);
      const sprite = this.add
        .sprite(0, 0, character.id, 0)
        .setOrigin(0.5, 1)
        .setScale(scale);
      const label = this.add
        .text(0, 0, character.name, {
          fontFamily: 'Segoe UI',
          fontSize: '10px',
          color: '#443d35',
          backgroundColor: '#ffffff',
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5, 1)
        .setDepth(3000);
      const actor: Actor = {
        character,
        walker,
        sprite,
        shadow,
        label,
        facing: 'down',
        elapsed: 0,
      };
      this.draw(actor);
      return actor;
    }
    // Other characters stand still, so they are obstacles for the one being moved.
    blockedByOthers(actor: Actor) {
      const taken = new Set(
        this.actors
          .filter((a) => a !== actor)
          .map((a) => `${a.walker.cell.x},${a.walker.cell.y}`),
      );
      return (cell: Cell) => !taken.has(`${cell.x},${cell.y}`);
    }
    get akira() {
      return this.actors.find((a) => a.character.id === controlled)!;
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
      const actor = this.akira;
      const { walker } = actor;
      const result = goTo(walker, goal, this.blockedByOthers(actor));
      if (result === 'blocked') {
        report(
          'Tujuan terhalang dinding, furnitur, tanaman, air kolam, karakter lain, atau di luar kantor.',
        );
        return;
      }
      if (result === 'unreachable') {
        report('Tujuan tidak memiliki jalur yang dapat dilalui.');
        return;
      }
      if (result === 'queued') return;
      const p = toScreen(goal);
      this.marker
        .clear()
        .lineStyle(2, 0x9a6b13)
        .strokeEllipse(p.x, p.y, 25, 12);
      this.marker.lineStyle(2, 0xb58a32, 0.65);
      const points = [walker.cell, ...walker.route].map(toScreen);
      for (let i = 1; i < points.length; i++)
        this.marker.lineBetween(
          points[i - 1]!.x,
          points[i - 1]!.y,
          points[i]!.x,
          points[i]!.y,
        );
      report(
        result === 'started'
          ? `Akira menuju ${roomAt(goal)?.name ?? 'tujuan'} · petak ${goal.x + 1}, ${goal.y + 1}.`
          : `Akira di petak ${walker.cell.x + 1}, ${walker.cell.y + 1}.`,
      );
    }
    draw(actor: Actor) {
      const { sprite, shadow, label, walker, character } = actor;
      const info = spriteInfo[character.id];
      const p = walkerPoint(walker);
      sprite.setPosition(p.x, p.y + 3).setDepth(p.y + 3);
      shadow.setPosition(p.x, p.y + 1).setDepth(p.y);
      label.setPosition(p.x, p.y - info.frame.height * info.scale - 2);
      const moving = walker.route.length > 0;
      const row = rowOf[actor.facing];
      const count = info.frames[row === 0 ? 'down' : row === 1 ? 'side' : 'up'];
      // Idle uses the first frame; walking cycles through the row.
      const column = moving ? Math.floor(actor.elapsed / 140) % count : 0;
      sprite.setFrame(row * info.columns + column);
      // The sheet draws the sideways walk in one direction only.
      sprite.setFlipX(
        (actor.facing === 'left' || actor.facing === 'right') &&
          actor.facing !== info.sideFacing,
      );
    }
    arrived(actor: Actor) {
      report(
        `Akira tiba di ${roomAt(actor.walker.cell)?.name} · petak ${actor.walker.cell.x + 1}, ${actor.walker.cell.y + 1}.`,
      );
    }
    update(_time: number, delta: number) {
      if (!this.loaded || paused) return;
      const actor = this.akira;
      const { walker } = actor;
      if (!walker.route.length) return;
      if (reducedMotion.matches) {
        snapToGoal(walker);
        this.draw(actor);
        this.arrived(actor);
        return;
      }
      actor.elapsed += delta;
      const next = heading(walker);
      if (next) actor.facing = next;
      const state = advance(walker, delta, this.blockedByOthers(actor));
      if (state === 'arrived') this.arrived(actor);
      // After a step the next heading may differ; keep the walk cycle in sync.
      this.draw(actor);
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
