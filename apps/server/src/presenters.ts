import type { DatabaseSync } from 'node:sqlite';
import {
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
import { cleanName, sniffType } from './files.js';
import { probe } from './ffmpeg.js';

// A presenter is a reusable profile: a name, a style and a few reference photos of a person
// who agreed to appear. Phase 1 only keeps them and lets a photo be used as a scene; it does
// not generate or animate a face.
export const presenterSchema = `
CREATE TABLE IF NOT EXISTS presenters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  style TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  consent_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS presenter_photos (
  id TEXT PRIMARY KEY,
  presenter_id TEXT NOT NULL REFERENCES presenters(id),
  file TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
`;

const MAX_PHOTOS = 5;
const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};
type Row = Record<string, string | number | null>;

type Deps = {
  db: DatabaseSync;
  mediaDir: string | undefined;
  ffprobe: string;
  audit: (action: string, detail: string) => void;
  announce: () => void;
};

const uuid = z.string().uuid();
const profile = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(60),
  style: z.enum(['casual', 'profesional', 'soft-sell', 'energetic']),
  notes: z.string().trim().max(500).default(''),
});
const createBody = profile.extend({
  // Required: the face must be Leo's own or used with the person's permission.
  consent: z.literal(true, { error: 'Centang pernyataan izin wajah dulu.' }),
});

export function registerPresenterRoutes(app: FastifyInstance, deps: Deps) {
  const { db, audit, announce } = deps;
  const root = deps.mediaDir ? resolve(deps.mediaDir) : null;
  const notFound = (reply: FastifyReply) =>
    reply.code(404).send({ error: 'Presenter tidak ditemukan.' });
  const notReady = (reply: FastifyReply) =>
    root
      ? null
      : reply.code(409).send({
          error:
            'MEDIA_DIR belum diatur di .env server (gunakan folder di drive E:).',
        });

  const view = (r: Row) => ({
    id: String(r.id),
    name: String(r.name),
    style: String(r.style),
    notes: String(r.notes),
    consentAt: Number(r.consent_at),
    createdAt: Number(r.created_at),
    photos: (
      db
        .prepare(
          'SELECT * FROM presenter_photos WHERE presenter_id = ? AND deleted_at IS NULL ORDER BY created_at',
        )
        .all(String(r.id)) as Row[]
    ).map((p) => ({
      id: String(p.id),
      name: String(p.name),
      mime: String(p.mime),
      bytes: Number(p.bytes),
      width: p.width === null ? null : Number(p.width),
      height: p.height === null ? null : Number(p.height),
    })),
  });
  const row = (id: string) =>
    db
      .prepare('SELECT * FROM presenters WHERE id = ? AND deleted_at IS NULL')
      .get(id) as Row | undefined;
  const idOf = (request: { params: unknown }) =>
    uuid.safeParse((request.params as { id: string }).id);

  app.get('/presenters', () => ({
    presenters: (
      db
        .prepare(
          'SELECT * FROM presenters WHERE deleted_at IS NULL ORDER BY created_at DESC',
        )
        .all() as Row[]
    ).map(view),
  }));

  app.post('/presenters', async (request, reply) => {
    const body = createBody.safeParse(request.body);
    if (!body.success)
      return reply
        .code(400)
        .send({ error: body.error.issues[0]?.message ?? 'Input tidak valid.' });
    const id = randomUUID();
    const now = Date.now();
    db.prepare(
      'INSERT INTO presenters (id, name, style, notes, consent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, body.data.name, body.data.style, body.data.notes, now, now, now);
    audit('presenter.create', `${id} izin wajah dinyatakan`);
    announce();
    return reply.code(201).send({ presenter: view(row(id)!) });
  });

  app.put('/presenters/:id', async (request, reply) => {
    const id = idOf(request);
    const found = id.success ? row(id.data) : undefined;
    if (!id.success || !found) return notFound(reply);
    const body = profile.safeParse(request.body);
    if (!body.success)
      return reply
        .code(400)
        .send({ error: body.error.issues[0]?.message ?? 'Input tidak valid.' });
    db.prepare(
      'UPDATE presenters SET name = ?, style = ?, notes = ?, updated_at = ? WHERE id = ?',
    ).run(
      body.data.name,
      body.data.style,
      body.data.notes,
      Date.now(),
      id.data,
    );
    audit('presenter.update', id.data);
    announce();
    return { presenter: view(row(id.data)!) };
  });

  // Hidden, not erased: photos stay on disk.
  app.delete('/presenters/:id', async (request, reply) => {
    const id = idOf(request);
    if (!id.success || !row(id.data)) return notFound(reply);
    db.prepare('UPDATE presenters SET deleted_at = ? WHERE id = ?').run(
      Date.now(),
      id.data,
    );
    audit('presenter.delete', id.data);
    announce();
    return reply.code(204).send();
  });

  app.post('/presenters/:id/photos', async (request, reply) => {
    const id = idOf(request);
    const found = id.success ? row(id.data) : undefined;
    if (!id.success || !found) return notFound(reply);
    const blocked = notReady(reply);
    if (blocked) return blocked;
    const bytes = request.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0)
      return reply.code(400).send({ error: 'File kosong.' });
    const active = db
      .prepare(
        'SELECT COUNT(*) AS n FROM presenter_photos WHERE presenter_id = ? AND deleted_at IS NULL',
      )
      .get(id.data) as { n: number };
    if (active.n >= MAX_PHOTOS)
      return reply
        .code(400)
        .send({ error: `Maksimal ${MAX_PHOTOS} foto per presenter.` });
    let raw = String(request.headers['x-file-name'] ?? 'foto');
    try {
      raw = decodeURIComponent(raw);
    } catch {
      // A badly encoded name is kept as sent and cleaned below.
    }
    const name = cleanName(raw);
    const type = sniffType(bytes, name);
    if (!type || !TYPES.includes(type))
      return reply.code(415).send({ error: 'Foto harus PNG, JPG, atau WebP.' });
    if (bytes.length > MAX_BYTES)
      return reply.code(413).send({ error: 'File terlalu besar.' });
    const photoId = randomUUID();
    const rel = `presenters/${id.data}/${photoId}${EXT[type]}`;
    const full = join(root!, ...rel.split('/'));
    mkdirSync(join(root!, 'presenters', id.data), { recursive: true });
    writeFileSync(full, bytes);
    const info = await probe(deps.ffprobe, full);
    if (!info?.width) {
      rmSync(full, { force: true });
      return reply
        .code(415)
        .send({ error: 'File tidak bisa dibaca sebagai gambar.' });
    }
    db.prepare(
      'INSERT INTO presenter_photos (id, presenter_id, file, name, mime, bytes, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      photoId,
      id.data,
      rel,
      name,
      type,
      bytes.length,
      info.width,
      info.height,
      Date.now(),
    );
    audit('presenter.photo', `${id.data} ${name}`);
    announce();
    return reply.code(201).send({ presenter: view(row(id.data)!) });
  });

  app.delete('/presenters/:id/photos/:photoId', async (request, reply) => {
    const id = idOf(request);
    const photoId = uuid.safeParse(
      (request.params as { photoId: string }).photoId,
    );
    if (!id.success || !photoId.success || !row(id.data))
      return notFound(reply);
    const done = db
      .prepare(
        'UPDATE presenter_photos SET deleted_at = ? WHERE id = ? AND presenter_id = ? AND deleted_at IS NULL',
      )
      .run(Date.now(), photoId.data, id.data);
    if (!done.changes)
      return reply.code(404).send({ error: 'Foto tidak ditemukan.' });
    audit('presenter.photo_delete', `${id.data} ${photoId.data}`);
    announce();
    return reply.code(204).send();
  });

  app.get('/presenters/photos/:photoId/file', async (request, reply) => {
    const photoId = uuid.safeParse(
      (request.params as { photoId: string }).photoId,
    );
    const photo =
      root && photoId.success
        ? (db
            .prepare(
              'SELECT * FROM presenter_photos WHERE id = ? AND deleted_at IS NULL',
            )
            .get(photoId.data) as Row | undefined)
        : undefined;
    const full = photo ? join(root!, ...String(photo.file).split('/')) : '';
    if (!photo || !existsSync(full) || !statSync(full).isFile())
      return reply.code(404).send({ error: 'Foto tidak ditemukan.' });
    return reply
      .header('content-type', String(photo.mime))
      .header('content-disposition', 'inline')
      .header('content-security-policy', "default-src 'none'; sandbox")
      .send(createReadStream(full));
  });
}
