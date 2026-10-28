import type { DatabaseSync } from 'node:sqlite';
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { BACKGROUND_PRESETS } from '@204/contracts';
import type { Campaigns } from './campaigns.js';
import { cleanName, sniffType } from './files.js';
import {
  probe,
  renderArgs,
  run,
  subtitleFile,
  totalSeconds,
  fitArgs,
  type RenderPlan,
} from './ffmpeg.js';

export const mediaSchema = `
CREATE TABLE IF NOT EXISTS campaign_assets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  file TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  seconds REAL,
  source_asset_id TEXT,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS render_jobs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  plan TEXT NOT NULL,
  output_asset_id TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
`;

const IMAGE_KINDS = ['product', 'presenter', 'background'] as const;
const KINDS = [...IMAGE_KINDS, 'music'] as const;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const LIMITS = {
  image: 25 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};
const EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};
const MAX_VIDEO_SECONDS = 90;
const RENDER_TIMEOUT_MS = 15 * 60_000;

type Row = Record<string, string | number | null>;
const toAsset = (r: Row) => ({
  id: String(r.id),
  campaignId: String(r.campaign_id),
  kind: String(r.kind),
  name: String(r.name),
  mime: String(r.mime),
  bytes: Number(r.bytes),
  width: r.width === null ? null : Number(r.width),
  height: r.height === null ? null : Number(r.height),
  seconds: r.seconds === null ? null : Number(r.seconds),
  sourceAssetId: r.source_asset_id === null ? null : String(r.source_asset_id),
  createdAt: Number(r.created_at),
});
const toJob = (r: Row) => ({
  id: String(r.id),
  campaignId: String(r.campaign_id),
  status: String(r.status) as 'queued' | 'running' | 'done' | 'failed',
  progress: Number(r.progress),
  outputAssetId: r.output_asset_id === null ? null : String(r.output_asset_id),
  error: r.error === null ? null : String(r.error),
  createdAt: Number(r.created_at),
  finishedAt: r.finished_at === null ? null : Number(r.finished_at),
});

type Deps = {
  db: DatabaseSync;
  campaigns: Campaigns;
  mediaDir: string | undefined;
  ffmpeg: string;
  ffprobe: string;
  audit: (action: string, detail: string) => void;
  announce: () => void;
};

const uuid = z.string().uuid();
const fitBody = z.object({
  fit: z.enum(['cover', 'contain']).default('cover'),
  rotate: z
    .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
    .default(0),
  brightness: z.number().min(-0.5).max(0.5).default(0),
  contrast: z.number().min(0.5).max(2).default(1),
  saturation: z.number().min(0).max(2).default(1),
});
const renderBody = z.object({
  scenes: z
    .array(
      z.object({
        assetId: uuid,
        backgroundAssetId: uuid.nullable().default(null),
        trimStart: z.number().min(0).max(3600).default(0),
        seconds: z.number().int().min(1).max(15),
        text: z.string().trim().max(200).default(''),
      }),
    )
    .min(1)
    .max(20),
  transition: z.enum(['none', 'fade']).default('fade'),
  motion: z.enum(['none', 'zoom']).default('zoom'),
  musicAssetId: uuid.nullable().default(null),
});

export function registerMediaRoutes(app: FastifyInstance, deps: Deps) {
  const { db, campaigns, audit, announce } = deps;
  const root = deps.mediaDir ? resolve(deps.mediaDir) : null;

  // Jobs a crash left unfinished can never finish; say so instead of showing them as running.
  db.prepare(
    "UPDATE render_jobs SET status = 'failed', error = 'Server berhenti sebelum selesai.', finished_at = ? WHERE status IN ('queued', 'running')",
  ).run(Date.now());

  const assetRow = (id: string) =>
    db
      .prepare(
        'SELECT * FROM campaign_assets WHERE id = ? AND deleted_at IS NULL',
      )
      .get(id) as Row | undefined;
  const fileOf = (r: Row) => join(root!, ...String(r.file).split('/'));
  const folder = (...parts: string[]) => {
    const dir = join(root!, ...parts);
    mkdirSync(dir, { recursive: true });
    return dir;
  };

  // Looked up once it succeeds; a missing FFmpeg is looked up again so installing it needs no restart.
  let ffmpegInfo: { available: boolean; version: string } | null = null;
  const ffmpegStatus = async () => {
    if (ffmpegInfo?.available) return ffmpegInfo;
    const result = await run(deps.ffmpeg, ['-version'], { timeoutMs: 10_000 });
    ffmpegInfo = {
      available: result.code === 0,
      version: (result.stdout.split(/\r?\n/)[0] ?? '')
        .replace(/ Copyright.*/, '')
        .trim(),
    };
    return ffmpegInfo;
  };

  const notReady = async (reply: FastifyReply) => {
    if (!root)
      return reply.code(409).send({
        error:
          'MEDIA_DIR belum diatur di .env server (gunakan folder di drive E:).',
      });
    if (!(await ffmpegStatus()).available)
      return reply.code(409).send({
        error: 'FFmpeg tidak ditemukan. Atur FFMPEG_PATH atau pasang FFmpeg.',
      });
    return null;
  };
  const campaignOr404 = (reply: FastifyReply, raw: string) => {
    const id = uuid.safeParse(raw);
    const campaign = id.success ? campaigns.get(id.data) : null;
    if (!campaign) {
      reply.code(404).send({ error: 'Campaign tidak ditemukan.' });
      return null;
    }
    return campaign;
  };

  const addAsset = (a: {
    campaignId: string;
    kind: string;
    name: string;
    file: string;
    mime: string;
    bytes: number;
    width: number | null;
    height: number | null;
    seconds: number | null;
    sourceAssetId?: string;
  }) => {
    const id = randomUUID();
    db.prepare(
      'INSERT INTO campaign_assets (id, campaign_id, kind, name, file, mime, bytes, width, height, seconds, source_asset_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      a.campaignId,
      a.kind,
      a.name,
      a.file,
      a.mime,
      a.bytes,
      a.width,
      a.height,
      a.seconds,
      a.sourceAssetId ?? null,
      Date.now(),
    );
    return toAsset(assetRow(id)!);
  };

  // Every exported video across campaigns, newest first, for the Content Library.
  app.get('/media/library', () => {
    const rows = db
      .prepare(
        "SELECT * FROM campaign_assets WHERE kind = 'export' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100",
      )
      .all() as Row[];
    return {
      exports: rows.map((r) => ({
        ...toAsset(r),
        campaignName:
          campaigns.get(String(r.campaign_id))?.config.name ??
          '(campaign dihapus)',
      })),
    };
  });

  app.get('/media/status', async () => ({
    configured: Boolean(root),
    dir: root,
    // Media is meant to live on E:, not the small system drive.
    onSystemDrive: root ? /^c:/i.test(root) : false,
    ffmpeg: root ? await ffmpegStatus() : { available: false, version: '' },
    limits: {
      imageBytes: LIMITS.image,
      audioBytes: LIMITS.audio,
      maxVideoSeconds: MAX_VIDEO_SECONDS,
    },
    cost: 'Gratis: semua pemrosesan berjalan lokal dengan FFmpeg.',
  }));

  app.get('/campaigns/:id/assets', async (request, reply) => {
    const campaign = campaignOr404(
      reply,
      (request.params as { id: string }).id,
    );
    if (!campaign) return reply;
    const rows = db
      .prepare(
        'SELECT * FROM campaign_assets WHERE campaign_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      )
      .all(campaign.id) as Row[];
    return { assets: rows.map(toAsset) };
  });

  app.post('/campaigns/:id/assets', async (request, reply) => {
    const campaign = campaignOr404(
      reply,
      (request.params as { id: string }).id,
    );
    if (!campaign) return reply;
    const blocked = await notReady(reply);
    if (blocked) return blocked;
    const kind = z.enum(KINDS).safeParse(request.headers['x-asset-kind']);
    const bytes = request.body;
    if (!kind.success)
      return reply.code(400).send({ error: 'Jenis aset tidak valid.' });
    if (!Buffer.isBuffer(bytes) || bytes.length === 0)
      return reply.code(400).send({ error: 'File kosong.' });
    let raw = String(request.headers['x-file-name'] ?? 'aset');
    try {
      raw = decodeURIComponent(raw);
    } catch {
      // A badly encoded name is kept as sent and cleaned below.
    }
    const name = cleanName(raw);
    const type = sniffType(bytes, name);
    const isMusic = kind.data === 'music';
    // Product clips are allowed next to product photos; everything else is a photo.
    const allowed = isMusic
      ? AUDIO_TYPES
      : kind.data === 'product'
        ? [...IMAGE_TYPES, ...VIDEO_TYPES]
        : IMAGE_TYPES;
    if (!type || !allowed.includes(type))
      return reply.code(415).send({
        error: isMusic
          ? 'Musik harus MP3 atau WAV.'
          : kind.data === 'product'
            ? 'Berkas harus foto (PNG, JPG, WebP) atau video (MP4, WebM).'
            : 'Foto harus PNG, JPG, atau WebP.',
      });
    const limit = isMusic
      ? LIMITS.audio
      : VIDEO_TYPES.includes(type)
        ? LIMITS.video
        : LIMITS.image;
    if (bytes.length > limit)
      return reply.code(413).send({ error: 'File terlalu besar.' });

    const id = randomUUID();
    const rel = `assets/${campaign.id}/${id}${EXT[type]}`;
    folder('assets', campaign.id);
    writeFileSync(join(root!, ...rel.split('/')), bytes);
    const info = await probe(deps.ffprobe, join(root!, ...rel.split('/')));
    if (!isMusic && (!info || !info.width)) {
      rmSync(join(root!, ...rel.split('/')), { force: true });
      return reply
        .code(415)
        .send({ error: 'File tidak bisa dibaca sebagai gambar.' });
    }
    const asset = addAsset({
      campaignId: campaign.id,
      kind: kind.data,
      name,
      file: rel,
      mime: type,
      bytes: bytes.length,
      width: info?.width ?? null,
      height: info?.height ?? null,
      seconds: info?.seconds ?? null,
    });
    audit('asset.upload', `${campaign.id} ${kind.data} ${name}`);
    announce();
    return reply.code(201).send({ asset });
  });

  app.delete('/campaigns/:id/assets/:assetId', async (request, reply) => {
    const campaign = campaignOr404(
      reply,
      (request.params as { id: string }).id,
    );
    if (!campaign) return reply;
    const assetId = uuid.safeParse(
      (request.params as { assetId: string }).assetId,
    );
    const row = assetId.success ? assetRow(assetId.data) : undefined;
    if (!row || row.campaign_id !== campaign.id)
      return reply.code(404).send({ error: 'Aset tidak ditemukan.' });
    // Hidden, not erased: the file stays on disk.
    db.prepare('UPDATE campaign_assets SET deleted_at = ? WHERE id = ?').run(
      Date.now(),
      String(row.id),
    );
    audit('asset.delete', `${campaign.id} ${row.id}`);
    announce();
    return reply.code(204).send();
  });

  // A tidy 9:16 copy of a photo; the original is never changed.
  app.post('/campaigns/:id/assets/:assetId/fit', async (request, reply) => {
    const campaign = campaignOr404(
      reply,
      (request.params as { id: string }).id,
    );
    if (!campaign) return reply;
    const blocked = await notReady(reply);
    if (blocked) return blocked;
    const assetId = uuid.safeParse(
      (request.params as { assetId: string }).assetId,
    );
    const row = assetId.success ? assetRow(assetId.data) : undefined;
    if (
      !row ||
      row.campaign_id !== campaign.id ||
      !IMAGE_TYPES.includes(String(row.mime))
    )
      return reply.code(404).send({ error: 'Foto tidak ditemukan.' });
    const body = fitBody.safeParse(request.body ?? {});
    if (!body.success)
      return reply.code(400).send({ error: 'Pengaturan tidak valid.' });

    const id = randomUUID();
    const rel = `assets/${campaign.id}/${id}.jpg`;
    folder('assets', campaign.id);
    const out = join(root!, ...rel.split('/'));
    const result = await run(
      deps.ffmpeg,
      fitArgs(fileOf(row), out, body.data),
      { timeoutMs: 60_000 },
    );
    if (result.code !== 0 || !existsSync(out)) {
      audit('asset.fit_failed', `${campaign.id} ${row.id}`);
      return reply.code(502).send({ error: 'FFmpeg gagal memproses foto.' });
    }
    const info = await probe(deps.ffprobe, out);
    const base = String(row.name).replace(/\.[^.]+$/, '');
    const asset = addAsset({
      campaignId: campaign.id,
      kind: String(row.kind),
      name: `${base}-9x16.jpg`,
      file: rel,
      mime: 'image/jpeg',
      bytes: statSync(out).size,
      width: info?.width ?? null,
      height: info?.height ?? null,
      seconds: null,
      sourceAssetId: String(row.id),
    });
    audit('asset.fit', `${campaign.id} ${row.id} ${body.data.fit}`);
    announce();
    return reply.code(201).send({ asset });
  });

  // A plain gradient backdrop made locally, for campaigns with no backdrop photo of their own.
  app.post(
    '/campaigns/:id/assets/background-preset',
    async (request, reply) => {
      const campaign = campaignOr404(
        reply,
        (request.params as { id: string }).id,
      );
      if (!campaign) return reply;
      const blocked = await notReady(reply);
      if (blocked) return blocked;
      const body = z
        .object({ preset: z.string().max(40) })
        .safeParse(request.body);
      const preset = body.success
        ? BACKGROUND_PRESETS.find((p) => p.id === body.data.preset)
        : undefined;
      if (!preset)
        return reply.code(400).send({ error: 'Latar tidak dikenal.' });
      const id = randomUUID();
      const rel = `assets/${campaign.id}/${id}.jpg`;
      folder('assets', campaign.id);
      const out = join(root!, ...rel.split('/'));
      const source = `gradients=s=1080x1920:c0=0x${preset.c0}:c1=0x${preset.c1}:x0=540:y0=0:x1=540:y1=1920:nb_colors=2:d=1`;
      const result = await run(
        deps.ffmpeg,
        [
          '-y',
          '-hide_banner',
          '-f',
          'lavfi',
          '-i',
          source,
          '-frames:v',
          '1',
          '-q:v',
          '2',
          out,
        ],
        { timeoutMs: 30_000 },
      );
      if (result.code !== 0 || !existsSync(out))
        return reply.code(502).send({ error: 'FFmpeg gagal membuat latar.' });
      const asset = addAsset({
        campaignId: campaign.id,
        kind: 'background',
        name: preset.label,
        file: rel,
        mime: 'image/jpeg',
        bytes: statSync(out).size,
        width: 1080,
        height: 1920,
        seconds: null,
      });
      audit('asset.background', `${campaign.id} ${preset.id}`);
      announce();
      return reply.code(201).send({ asset });
    },
  );

  // Copies a presenter reference photo into the campaign so it can be used as a scene.
  app.post('/campaigns/:id/assets/from-presenter', async (request, reply) => {
    const campaign = campaignOr404(
      reply,
      (request.params as { id: string }).id,
    );
    if (!campaign) return reply;
    const blocked = await notReady(reply);
    if (blocked) return blocked;
    const body = z.object({ photoId: uuid }).safeParse(request.body);
    const photo = body.success
      ? (db
          .prepare(
            'SELECT f.* FROM presenter_photos f JOIN presenters p ON p.id = f.presenter_id WHERE f.id = ? AND f.deleted_at IS NULL AND p.deleted_at IS NULL',
          )
          .get(body.data.photoId) as Row | undefined)
      : undefined;
    const source = photo ? join(root!, ...String(photo.file).split('/')) : '';
    if (!photo || !existsSync(source))
      return reply.code(404).send({ error: 'Foto presenter tidak ditemukan.' });
    const id = randomUUID();
    const rel = `assets/${campaign.id}/${id}${EXT[String(photo.mime)] ?? '.jpg'}`;
    folder('assets', campaign.id);
    copyFileSync(source, join(root!, ...rel.split('/')));
    const asset = addAsset({
      campaignId: campaign.id,
      kind: 'presenter',
      name: String(photo.name),
      file: rel,
      mime: String(photo.mime),
      bytes: Number(photo.bytes),
      width: photo.width === null ? null : Number(photo.width),
      height: photo.height === null ? null : Number(photo.height),
      seconds: null,
    });
    audit('asset.from_presenter', `${campaign.id} ${String(photo.id)}`);
    announce();
    return reply.code(201).send({ asset });
  });

  app.get('/media/:assetId/file', async (request, reply) => {
    const assetId = uuid.safeParse(
      (request.params as { assetId: string }).assetId,
    );
    const row = root && assetId.success ? assetRow(assetId.data) : undefined;
    if (!row || !existsSync(fileOf(row)))
      return reply.code(404).send({ error: 'Aset tidak ditemukan.' });
    const mime = String(row.mime);
    const disposition = mime.startsWith('image/')
      ? 'inline'
      : `attachment; filename*=UTF-8''${encodeURIComponent(String(row.name))}`;
    return reply
      .header('content-type', mime)
      .header('content-disposition', disposition)
      .header('content-security-policy', "default-src 'none'; sandbox")
      .send(createReadStream(fileOf(row)));
  });

  // ---- Video export: one job at a time, run in the background ----------------------
  const queue: string[] = [];
  let working = false;
  const jobRow = (id: string) =>
    db.prepare('SELECT * FROM render_jobs WHERE id = ?').get(id) as
      Row | undefined;
  const setJob = (
    id: string,
    patch: {
      status?: string;
      progress?: number;
      outputAssetId?: string;
      error?: string;
      finished?: boolean;
    },
  ) => {
    const current = jobRow(id)!;
    db.prepare(
      'UPDATE render_jobs SET status = ?, progress = ?, output_asset_id = ?, error = ?, finished_at = ? WHERE id = ?',
    ).run(
      patch.status ?? current.status ?? null,
      patch.progress ?? current.progress ?? 0,
      patch.outputAssetId ?? current.output_asset_id ?? null,
      patch.error ?? current.error ?? null,
      patch.finished ? Date.now() : (current.finished_at ?? null),
      id,
    );
    announce();
  };

  async function runJob(id: string) {
    const row = jobRow(id)!;
    const plan = JSON.parse(String(row.plan)) as {
      scenes: {
        path: string;
        seconds: number;
        text: string;
        video: boolean;
        trimStart: number;
        background: string | null;
      }[];
      transition: 'none' | 'fade';
      motion: 'none' | 'zoom';
      music: string | null;
    };
    const campaignId = String(row.campaign_id);
    const temp = folder('tmp', id);
    const rel = `exports/${campaignId}/${id}.mp4`;
    folder('exports', campaignId);
    const output = join(root!, ...rel.split('/'));
    const scenes = plan.scenes.map((s) => ({
      image: s.path,
      seconds: s.seconds,
      text: s.text,
      video: s.video,
      trimStart: s.trimStart,
      background: s.background,
    }));
    writeFileSync(join(temp, 'subs.srt'), subtitleFile(scenes));
    const total = totalSeconds(scenes);
    const full: RenderPlan = {
      scenes,
      transition: plan.transition,
      motion: plan.motion,
      music: plan.music,
      output,
      subtitles: 'subs.srt',
    };
    setJob(id, { status: 'running', progress: 0 });
    let last = 0;
    try {
      const result = await run(deps.ffmpeg, renderArgs(full), {
        cwd: temp,
        timeoutMs: RENDER_TIMEOUT_MS,
        onProgress: (seconds) => {
          const now = Date.now();
          if (now - last > 1500) {
            last = now;
            db.prepare('UPDATE render_jobs SET progress = ? WHERE id = ?').run(
              Math.min(0.99, seconds / total),
              id,
            );
          }
        },
      });
      if (result.code !== 0 || !existsSync(output)) {
        setJob(id, {
          status: 'failed',
          error: result.timedOut
            ? 'FFmpeg melewati batas waktu.'
            : `FFmpeg gagal: ${result.stderr.split('\n').slice(-3).join(' ').slice(0, 300)}`,
          finished: true,
        });
        audit('render.failed', `${campaignId} ${id}`);
        return;
      }
      const info = await probe(deps.ffprobe, output);
      const asset = addAsset({
        campaignId,
        kind: 'export',
        name: `video-${id.slice(0, 8)}.mp4`,
        file: rel,
        mime: 'video/mp4',
        bytes: statSync(output).size,
        width: info?.width ?? null,
        height: info?.height ?? null,
        seconds: info?.seconds ?? total,
      });
      setJob(id, {
        status: 'done',
        progress: 1,
        outputAssetId: asset.id,
        finished: true,
      });
      audit('render.done', `${campaignId} ${id}`);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }
  const pump = async () => {
    if (working) return;
    working = true;
    try {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try {
          await runJob(id);
        } catch {
          setJob(id, {
            status: 'failed',
            error: 'Terjadi kesalahan saat membuat video.',
            finished: true,
          });
        }
      }
    } finally {
      working = false;
    }
  };

  app.get('/campaigns/:id/render-jobs', async (request, reply) => {
    const campaign = campaignOr404(
      reply,
      (request.params as { id: string }).id,
    );
    if (!campaign) return reply;
    const rows = db
      .prepare(
        'SELECT * FROM render_jobs WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 30',
      )
      .all(campaign.id) as Row[];
    return { jobs: rows.map(toJob) };
  });

  app.post('/campaigns/:id/render', async (request, reply) => {
    const campaign = campaignOr404(
      reply,
      (request.params as { id: string }).id,
    );
    if (!campaign) return reply;
    const blocked = await notReady(reply);
    if (blocked) return blocked;
    const body = renderBody.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({
        error: body.error.issues[0]?.message ?? 'Pengaturan video tidak valid.',
      });
    const total = body.data.scenes.reduce((sum, s) => sum + s.seconds, 0);
    if (total > MAX_VIDEO_SECONDS)
      return reply
        .code(400)
        .send({ error: `Durasi total maksimum ${MAX_VIDEO_SECONDS} detik.` });
    if (queue.length >= 3)
      return reply
        .code(429)
        .send({ error: 'Antrean ekspor penuh. Tunggu yang berjalan selesai.' });

    const scenes: {
      path: string;
      seconds: number;
      text: string;
      video: boolean;
      trimStart: number;
      background: string | null;
    }[] = [];
    for (const scene of body.data.scenes) {
      const row = assetRow(scene.assetId);
      const mime = String(row?.mime ?? '');
      if (
        !row ||
        row.campaign_id !== campaign.id ||
        !(IMAGE_TYPES.includes(mime) || VIDEO_TYPES.includes(mime))
      )
        return reply.code(400).send({
          error:
            'Salah satu foto atau video scene tidak ditemukan di campaign ini.',
        });
      let background: string | null = null;
      if (scene.backgroundAssetId) {
        const bg = assetRow(scene.backgroundAssetId);
        if (
          !bg ||
          bg.campaign_id !== campaign.id ||
          !IMAGE_TYPES.includes(String(bg.mime))
        )
          return reply
            .code(400)
            .send({ error: 'Latar scene tidak ditemukan di campaign ini.' });
        background = fileOf(bg);
      }
      scenes.push({
        path: fileOf(row),
        seconds: scene.seconds,
        text: scene.text,
        video: VIDEO_TYPES.includes(mime),
        trimStart: scene.trimStart,
        background,
      });
    }
    let music: string | null = null;
    if (body.data.musicAssetId) {
      const row = assetRow(body.data.musicAssetId);
      if (
        !row ||
        row.campaign_id !== campaign.id ||
        !AUDIO_TYPES.includes(String(row.mime))
      )
        return reply
          .code(400)
          .send({ error: 'Musik tidak ditemukan di campaign ini.' });
      music = fileOf(row);
    }
    const id = randomUUID();
    db.prepare(
      "INSERT INTO render_jobs (id, campaign_id, status, plan, created_at) VALUES (?, ?, 'queued', ?, ?)",
    ).run(
      id,
      campaign.id,
      JSON.stringify({
        scenes,
        transition: body.data.transition,
        motion: body.data.motion,
        music,
      }),
      Date.now(),
    );
    audit(
      'render.start',
      `${campaign.id} ${id} ${scenes.length} scene ${total} dtk`,
    );
    queue.push(id);
    void pump();
    announce();
    return reply.code(202).send({ job: toJob(jobRow(id)!) });
  });
}
