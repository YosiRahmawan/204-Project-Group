import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
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
import { fitArgs, renderArgs, subtitleFile, totalSeconds } from './ffmpeg.js';

const hasFfmpeg =
  spawnSync('ffmpeg', ['-version']).status === 0 &&
  spawnSync('ffprobe', ['-version']).status === 0;
const password = 'correct-horse-battery';
const headers = { 'x-requested-with': '204' };
const dirs: string[] = [];
const apps: ReturnType<typeof createApp>[] = [];

describe('ffmpeg argument builders', () => {
  const fit = {
    fit: 'cover' as const,
    rotate: 0 as const,
    brightness: 0,
    contrast: 1,
    saturation: 1,
  };
  test('fit makes 9:16 and never writes over the input', () => {
    const cover = fitArgs('in.png', 'out.jpg', fit).join(' ');
    expect(cover).toContain(
      'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    );
    const contain = fitArgs('in.png', 'out.jpg', {
      ...fit,
      fit: 'contain',
      rotate: 90,
    }).join(' ');
    expect(contain).toContain('transpose=1');
    expect(contain).toContain('boxblur');
    expect(fitArgs('in.png', 'out.jpg', fit).at(-1)).toBe('out.jpg');
  });
  const scenes = [
    { image: 'a.jpg', seconds: 3, text: 'Halo <b>dunia</b>' },
    { image: 'b.jpg', seconds: 2, text: '' },
  ];
  test('subtitles follow scene times and drop markup', () => {
    const srt = subtitleFile(scenes);
    expect(srt).toContain('00:00:00,000 --> 00:00:02,950');
    expect(srt).toContain('Halo dunia');
    expect(srt).not.toContain('<b>');
    expect(subtitleFile([{ image: 'a', seconds: 2, text: '' }])).toBe('');
    expect(totalSeconds(scenes)).toBe(5);
  });
  test('render plan has one input per scene, optional fade, zoom and music', () => {
    const plan = {
      scenes,
      transition: 'fade' as const,
      motion: 'zoom' as const,
      music: 'm.mp3',
      output: 'o.mp4',
      subtitles: 'subs.srt',
    };
    const args = renderArgs(plan);
    expect(args.filter((a) => a === '-loop')).toHaveLength(2);
    const graph = args[args.indexOf('-filter_complex') + 1]!;
    expect(graph).toContain('concat=n=2');
    expect(graph).toContain('zoompan');
    expect(graph).toContain('fade=t=in');
    expect(graph).toContain('subtitles=subs.srt');
    expect(graph).toContain('[2:a]apad,atrim=0:5');
    expect(args).toContain('-map');
    const plain = renderArgs({
      ...plan,
      transition: 'none',
      motion: 'none',
      music: null,
      scenes: [{ image: 'a', seconds: 2, text: '' }],
    });
    const g2 = plain[plain.indexOf('-filter_complex') + 1]!;
    expect(g2).not.toContain('zoompan');
    expect(g2).not.toContain('fade');
    expect(g2).toContain('null[vout]');
    expect(plain).toContain('-an');
    // User text never reaches the command line; only generated file names do.
    expect(args.join(' ')).not.toContain('Halo');
  });
});

async function session(mediaDir: string | undefined) {
  const folder = mkdtempSync(join(tmpdir(), 'media-'));
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
    method: 'GET' | 'POST' | 'DELETE',
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
    campaignId: string,
    kind: string,
    name: string,
    bytes: Buffer,
  ) =>
    app.inject({
      method: 'POST',
      url: `/campaigns/${campaignId}/assets`,
      headers: {
        cookie,
        ...headers,
        'content-type': 'application/octet-stream',
        'x-asset-kind': kind,
        'x-file-name': encodeURIComponent(name),
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

test('media features say so when MEDIA_DIR is not set', async () => {
  const { call, upload, campaign } = await session(undefined);
  expect((await call('GET', '/media/status')).json().configured).toBe(false);
  expect(
    (await upload(campaign.id, 'product', 'a.png', Buffer.from('x')))
      .statusCode,
  ).toBe(409);
});

describe.skipIf(!hasFfmpeg)('media with FFmpeg', () => {
  const make = (dir: string, name: string, args: string[]) => {
    const file = join(dir, name);
    expect(
      spawnSync('ffmpeg', ['-y', '-v', 'error', ...args, file]).status,
    ).toBe(0);
    return readFileSync(file);
  };
  const fixtures = () => {
    const dir = mkdtempSync(join(tmpdir(), 'fixture-'));
    dirs.push(dir);
    return {
      photo: make(dir, 'foto.png', [
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=640x480:rate=1',
        '-frames:v',
        '1',
      ]),
      tone: make(dir, 'musik.wav', [
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=2',
      ]),
    };
  };
  const mediaDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'mediadir-'));
    dirs.push(dir);
    return join(dir, 'Media');
  };

  test('stores photos under MEDIA_DIR, rejects other files, and never changes the original', async () => {
    const dir = mediaDir();
    const { call, upload, campaign } = await session(dir);
    const { photo } = fixtures();
    expect((await call('GET', '/media/status')).json().ffmpeg.available).toBe(
      true,
    );
    const up = await upload(campaign.id, 'product', 'foto produk.png', photo);
    expect(up.statusCode).toBe(201);
    const asset = up.json().asset;
    expect(asset).toMatchObject({
      kind: 'product',
      mime: 'image/png',
      width: 640,
      height: 480,
    });
    expect(readdirSync(join(dir, 'assets', campaign.id))).toHaveLength(1);
    expect(
      (
        await upload(
          campaign.id,
          'product',
          'x.png',
          Buffer.from('bukan gambar'),
        )
      ).statusCode,
    ).toBe(415);
    expect(
      (await upload(campaign.id, 'music', 'x.png', photo)).statusCode,
    ).toBe(415);
    expect(
      (await upload(campaign.id, 'voice', 'x.png', photo)).statusCode,
    ).toBe(400);

    const fitted = await call(
      'POST',
      `/campaigns/${campaign.id}/assets/${asset.id}/fit`,
      { fit: 'contain', rotate: 0, brightness: 0.1 },
    );
    expect(fitted.statusCode).toBe(201);
    expect(fitted.json().asset).toMatchObject({
      width: 1080,
      height: 1920,
      sourceAssetId: asset.id,
      mime: 'image/jpeg',
    });
    const original = await call('GET', `/media/${asset.id}/file`);
    expect(original.rawPayload.length).toBe(photo.length);
    expect(
      (
        await call('POST', `/campaigns/${campaign.id}/assets/${asset.id}/fit`, {
          fit: 'stretch',
        })
      ).statusCode,
    ).toBe(400);
  });

  test('exports a real 9:16 MP4 with subtitles and music, and lists it as an asset', async () => {
    const dir = mediaDir();
    const { call, upload, campaign } = await session(dir);
    const { photo, tone } = fixtures();
    const a = (await upload(campaign.id, 'product', 'a.png', photo)).json()
      .asset;
    const b = (await upload(campaign.id, 'background', 'b.png', photo)).json()
      .asset;
    const m = (await upload(campaign.id, 'music', 'musik.wav', tone)).json()
      .asset;
    const start = await call('POST', `/campaigns/${campaign.id}/render`, {
      scenes: [
        { assetId: a.id, seconds: 2, text: 'Kopi enak' },
        { assetId: b.id, seconds: 2, text: '' },
      ],
      transition: 'fade',
      motion: 'zoom',
      musicAssetId: m.id,
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
    const video = (await call('GET', `/campaigns/${campaign.id}/assets`))
      .json()
      .assets.find((x: { id: string }) => x.id === job.outputAssetId);
    expect(video).toMatchObject({
      kind: 'export',
      mime: 'video/mp4',
      width: 1080,
      height: 1920,
    });
    expect(video.seconds).toBeGreaterThan(3.5);
    expect(video.seconds).toBeLessThan(4.5);
    const file = await call('GET', `/media/${video.id}/file`);
    expect(file.headers['content-type']).toBe('video/mp4');
    expect(String(file.headers['content-disposition'])).toContain('attachment');
    // The temporary working folder is gone.
    expect(existsTmp(dir)).toBe(false);
    const actions = (await call('GET', '/audit'))
      .json()
      .map((e: { action: string }) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(['asset.upload', 'render.start', 'render.done']),
    );
  }, 60_000);

  test('refuses bad render requests', async () => {
    const { call, upload, campaign } = await session(mediaDir());
    const { photo } = fixtures();
    const a = (await upload(campaign.id, 'product', 'a.png', photo)).json()
      .asset;
    const post = (body: object) =>
      call('POST', `/campaigns/${campaign.id}/render`, body);
    expect((await post({ scenes: [] })).statusCode).toBe(400);
    expect(
      (
        await post({
          scenes: [
            { assetId: '00000000-0000-4000-8000-000000000000', seconds: 2 },
          ],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post({
          scenes: Array.from({ length: 7 }, () => ({
            assetId: a.id,
            seconds: 15,
          })),
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post({
          scenes: [{ assetId: a.id, seconds: 2 }],
          musicAssetId: a.id,
        })
      ).statusCode,
    ).toBe(400);
  });

  test('hiding an asset keeps its file', async () => {
    const dir = mediaDir();
    const { call, upload, campaign } = await session(dir);
    const { photo } = fixtures();
    const a = (await upload(campaign.id, 'product', 'a.png', photo)).json()
      .asset;
    expect(
      (await call('DELETE', `/campaigns/${campaign.id}/assets/${a.id}`))
        .statusCode,
    ).toBe(204);
    expect(
      (await call('GET', `/campaigns/${campaign.id}/assets`)).json().assets,
    ).toHaveLength(0);
    expect(readdirSync(join(dir, 'assets', campaign.id))).toHaveLength(1);
  });
});

function existsTmp(dir: string) {
  try {
    return readdirSync(join(dir, 'tmp')).length > 0;
  } catch {
    mkdirSync(dir, { recursive: true });
    return false;
  }
}
