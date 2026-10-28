import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { emptyCampaign } from '@204/contracts';
import { createApp } from './app.js';
import { parseConfig } from './config.js';
import { renderArgs } from './ffmpeg.js';

const hasFfmpeg =
  spawnSync('ffmpeg', ['-version']).status === 0 &&
  spawnSync('ffprobe', ['-version']).status === 0;
const password = 'correct-horse-battery';
const headers = { 'x-requested-with': '204' };
const dirs: string[] = [];
const apps: ReturnType<typeof createApp>[] = [];

describe('render plan with backdrops and clips', () => {
  const base = {
    transition: 'none' as const,
    motion: 'zoom' as const,
    music: null,
    output: 'o.mp4',
    subtitles: 'subs.srt',
  };
  test('a backdrop scene overlays the photo and a clip is cut, held and never zoomed', () => {
    const args = renderArgs({
      ...base,
      scenes: [
        { image: 'p.jpg', seconds: 3, text: '', background: 'bg.jpg' },
        { image: 'c.mp4', seconds: 4, text: '', video: true, trimStart: 2 },
      ],
    });
    // Inputs: bg, photo, clip.
    expect(args.filter((a) => a === '-i')).toHaveLength(3);
    expect(args.filter((a) => a === '-loop')).toHaveLength(2);
    expect(args[args.indexOf('-ss') + 1]).toBe('2');
    const graph = args[args.indexOf('-filter_complex') + 1]!;
    expect(graph).toContain('overlay=(W-w)/2:(H-h)/2[c0]');
    expect(graph).toContain('tpad=stop_mode=clone:stop_duration=4');
    expect(graph.match(/zoompan/g)).toHaveLength(1);
    expect(graph).toContain('concat=n=2');
  });
  test('music is the input after every scene input', () => {
    const args = renderArgs({
      ...base,
      music: 'm.mp3',
      scenes: [{ image: 'p.jpg', seconds: 3, text: '', background: 'bg.jpg' }],
    });
    expect(args[args.indexOf('-filter_complex') + 1]).toContain('[2:a]apad');
  });
});

async function session(mediaDir: string | undefined) {
  const folder = mkdtempSync(join(tmpdir(), 'studio-'));
  dirs.push(folder);
  const app = createApp(
    parseConfig({
      OWNER_PASSWORD: password,
      DATABASE_PATH: join(folder, 'o.db'),
      UPLOAD_DIR: join(folder, 'up'),
      ...(mediaDir ? { MEDIA_DIR: mediaDir } : {}),
    }),
  );
  apps.push(app);
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers,
    payload: { password },
  });
  const cookie = String(login.headers['set-cookie']).split(';')[0]!;
  const call = (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: { cookie, ...headers },
      ...(payload ? { payload } : {}),
    });
  const upload = (
    url: string,
    name: string,
    bytes: Buffer,
    extra: Record<string, string> = {},
  ) =>
    app.inject({
      method: 'POST',
      url,
      headers: {
        cookie,
        ...headers,
        'content-type': 'application/octet-stream',
        'x-file-name': encodeURIComponent(name),
        ...extra,
      },
      payload: bytes,
    });
  const campaign = (
    await call('POST', '/campaigns', {
      config: {
        ...emptyCampaign(),
        name: 'Promo',
        product: { ...emptyCampaign().product, name: 'Kopi' },
      },
    })
  ).json().campaign;
  return { app, call, upload, campaign };
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});

describe('studio settings on a campaign', () => {
  test('a new campaign carries the studio defaults and keeps what Leo chooses', async () => {
    const { call, campaign } = await session(undefined);
    expect(campaign.config.studio).toMatchObject({
      durationSeconds: 30,
      ratio: '9:16',
      template: 'affiliate-promo',
      voiceStyle: 'santai',
      presenterId: null,
    });
    const saved = await call('PUT', `/campaigns/${campaign.id}`, {
      version: campaign.version,
      config: {
        ...campaign.config,
        studio: {
          ...campaign.config.studio,
          durationSeconds: 45,
          style: 'ugc',
          voiceId: 'Kore',
        },
      },
    });
    expect(saved.json().campaign.config.studio).toMatchObject({
      durationSeconds: 45,
      style: 'ugc',
      voiceId: 'Kore',
    });
    const bad = await call('PUT', `/campaigns/${campaign.id}`, {
      version: saved.json().campaign.version,
      config: {
        ...campaign.config,
        studio: { ...campaign.config.studio, durationSeconds: 25 },
      },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe.skipIf(!hasFfmpeg)('presenters, backdrops and clips', () => {
  const dir = () => {
    const d = mkdtempSync(join(tmpdir(), 'sdir-'));
    dirs.push(d);
    return d;
  };
  const make = (folder: string, name: string, args: string[]) => {
    const file = join(folder, name);
    expect(
      spawnSync('ffmpeg', ['-y', '-v', 'error', ...args, file]).status,
    ).toBe(0);
    return readFileSync(file);
  };
  const fixtures = () => {
    const f = dir();
    return {
      photo: make(f, 'wajah.png', [
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=600x800:rate=1',
        '-frames:v',
        '1',
      ]),
      clip: make(f, 'produk.mp4', [
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=640x360:rate=15:duration=3',
        '-pix_fmt',
        'yuv420p',
      ]),
    };
  };

  test('a presenter needs the consent statement, keeps up to five photos and is reusable', async () => {
    const media = join(dir(), 'Media');
    const { call, upload, campaign } = await session(media);
    const { photo } = fixtures();
    const input = { name: 'Sari', style: 'casual', notes: 'Rambut pendek' };
    expect((await call('POST', '/presenters', input)).statusCode).toBe(400);
    expect(
      (await call('POST', '/presenters', { ...input, consent: false }))
        .statusCode,
    ).toBe(400);
    const made = await call('POST', '/presenters', { ...input, consent: true });
    expect(made.statusCode).toBe(201);
    const id = made.json().presenter.id;
    expect(
      (
        await call('POST', '/presenters', {
          ...input,
          style: 'galak',
          consent: true,
        })
      ).statusCode,
    ).toBe(400);

    expect(
      (
        await upload(
          `/presenters/${id}/photos`,
          'x.png',
          Buffer.from('bukan gambar'),
        )
      ).statusCode,
    ).toBe(415);
    for (let i = 0; i < 5; i++)
      expect(
        (await upload(`/presenters/${id}/photos`, `f${i}.png`, photo))
          .statusCode,
      ).toBe(201);
    expect(
      (await upload(`/presenters/${id}/photos`, 'f6.png', photo)).statusCode,
    ).toBe(400);
    const listed = (await call('GET', '/presenters')).json().presenters[0];
    expect(listed.photos).toHaveLength(5);
    expect(listed.photos[0]).toMatchObject({ width: 600, height: 800 });
    expect(
      (await call('GET', `/presenters/photos/${listed.photos[0].id}/file`))
        .headers['content-type'],
    ).toBe('image/png');

    // The same photo can be pulled into two different campaigns.
    const second = (
      await call('POST', '/campaigns', {
        config: {
          ...emptyCampaign(),
          name: 'Promo dua',
          product: { ...emptyCampaign().product, name: 'Teh' },
        },
      })
    ).json().campaign;
    for (const c of [campaign, second]) {
      const copied = await call(
        'POST',
        `/campaigns/${c.id}/assets/from-presenter`,
        { photoId: listed.photos[0].id },
      );
      expect(copied.statusCode).toBe(201);
      expect(copied.json().asset).toMatchObject({
        kind: 'presenter',
        width: 600,
      });
    }
    expect(readdirSync(join(media, 'presenters', id))).toHaveLength(5);

    expect(
      (await call('DELETE', `/presenters/${id}/photos/${listed.photos[0].id}`))
        .statusCode,
    ).toBe(204);
    expect(
      (await call('GET', '/presenters')).json().presenters[0].photos,
    ).toHaveLength(4);
    expect((await call('DELETE', `/presenters/${id}`)).statusCode).toBe(204);
    expect((await call('GET', '/presenters')).json().presenters).toHaveLength(
      0,
    );
    // Hidden, not erased.
    expect(readdirSync(join(media, 'presenters', id))).toHaveLength(5);
    const actions = (await call('GET', '/audit'))
      .json()
      .map((e: { action: string }) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'presenter.create',
        'presenter.photo',
        'presenter.delete',
      ]),
    );
  });

  test('presenters say so when no media folder is set', async () => {
    const { call, upload } = await session(undefined);
    const id = (
      await call('POST', '/presenters', {
        name: 'Sari',
        style: 'casual',
        consent: true,
      })
    ).json().presenter.id;
    expect(
      (await upload(`/presenters/${id}/photos`, 'f.png', Buffer.from('x')))
        .statusCode,
    ).toBe(409);
  });

  test('makes a gradient backdrop locally and rejects unknown ones', async () => {
    const media = join(dir(), 'Media');
    const { call, campaign } = await session(media);
    const res = await call(
      'POST',
      `/campaigns/${campaign.id}/assets/background-preset`,
      { preset: 'studio-hangat' },
    );
    expect(res.statusCode).toBe(201);
    expect(res.json().asset).toMatchObject({
      kind: 'background',
      width: 1080,
      height: 1920,
      name: 'Studio hangat',
    });
    expect(
      (
        await call(
          'POST',
          `/campaigns/${campaign.id}/assets/background-preset`,
          { preset: 'kamar-mewah' },
        )
      ).statusCode,
    ).toBe(400);
  });

  test('exports a video made of a backdrop scene and a trimmed product clip', async () => {
    const media = join(dir(), 'Media');
    const { call, upload, campaign } = await session(media);
    const { photo, clip } = fixtures();
    const bg = (
      await call('POST', `/campaigns/${campaign.id}/assets/background-preset`, {
        preset: 'netral-putih',
      })
    ).json().asset;
    const still = (
      await upload(`/campaigns/${campaign.id}/assets`, 'foto.png', photo, {
        'x-asset-kind': 'product',
      })
    ).json().asset;
    const video = await upload(
      `/campaigns/${campaign.id}/assets`,
      'klip.mp4',
      clip,
      { 'x-asset-kind': 'product' },
    );
    expect(video.statusCode).toBe(201);
    expect(video.json().asset).toMatchObject({ mime: 'video/mp4', width: 640 });
    // A clip is only accepted as a product asset, never as a backdrop.
    expect(
      (
        await upload(`/campaigns/${campaign.id}/assets`, 'klip.mp4', clip, {
          'x-asset-kind': 'background',
        })
      ).statusCode,
    ).toBe(415);

    const start = await call('POST', `/campaigns/${campaign.id}/render`, {
      scenes: [
        {
          assetId: still.id,
          backgroundAssetId: bg.id,
          seconds: 2,
          text: 'Produk di latar',
        },
        { assetId: video.json().asset.id, seconds: 3, trimStart: 1, text: '' },
      ],
      transition: 'fade',
      motion: 'zoom',
    });
    expect(start.statusCode).toBe(202);
    let job = start.json().job;
    for (let i = 0; i < 120 && !['done', 'failed'].includes(job.status); i++) {
      await new Promise((r) => setTimeout(r, 500));
      job = (await call('GET', `/campaigns/${campaign.id}/render-jobs`)).json()
        .jobs[0];
    }
    expect(job.error).toBeNull();
    expect(job.status).toBe('done');
    const out = (await call('GET', `/campaigns/${campaign.id}/assets`))
      .json()
      .assets.find((a: { id: string }) => a.id === job.outputAssetId);
    expect(out).toMatchObject({ width: 1080, height: 1920 });
    expect(out.seconds).toBeGreaterThan(4.5);
    expect(out.seconds).toBeLessThan(5.5);
    expect(existsSync(join(media, 'tmp', job.id))).toBe(false);

    const bad = (body: object) =>
      call('POST', `/campaigns/${campaign.id}/render`, {
        transition: 'none',
        motion: 'none',
        ...body,
      });
    expect(
      (
        await bad({
          scenes: [
            {
              assetId: still.id,
              backgroundAssetId: video.json().asset.id,
              seconds: 2,
            },
          ],
        })
      ).statusCode,
    ).toBe(400);
  }, 90_000);
});
