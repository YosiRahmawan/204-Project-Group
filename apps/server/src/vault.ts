import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve, sep } from 'node:path';
import type { AgentInput } from '@204/contracts';

// The shared memory is a folder of Markdown notes: an existing Obsidian vault. Everything that
// touches the disk goes through here, so path, secret and conflict rules live in one place.
export const AREAS = [
  'Agents',
  'Shared',
  'Strategy',
  'Campaigns',
  'Decisions',
  'Logs',
] as const;
export type Area = (typeof AREAS)[number];
// Areas every agent may read and may only change through a proposal Leo approves.
export const SHARED_AREAS: readonly string[] = [
  'Shared',
  'Strategy',
  'Campaigns',
  'Decisions',
];
const MAX_BYTES = 64 * 1024;
const MAX_BACKUPS = 10;
const BACKUP_DIR = '.204-backups';

export class VaultError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export const hashOf = (text: string) =>
  createHash('sha256').update(text).digest('hex');

// Notes must never carry credentials; the vault is plain text that other tools can read.
const secretPatterns: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/,
  /\b(password|passwd|kata\s*sandi|api[_-]?key|secret|token)\b\s*[:=]\s*\S{6,}/i,
];
export function checkContent(content: string) {
  if (Buffer.byteLength(content) > MAX_BYTES)
    throw new VaultError('Catatan terlalu besar (maksimum 64 KB).');
  if (secretPatterns.some((p) => p.test(content)))
    throw new VaultError(
      'Catatan tampak berisi kunci, token, atau kata sandi. Hapus dulu; vault tidak boleh menyimpan rahasia.',
    );
}

// A note path is relative, made of plain names, inside one of the known areas.
export function cleanPath(raw: string): string {
  const parts = raw.split('/');
  const ok =
    parts.length >= 2 &&
    parts.length <= 6 &&
    (AREAS as readonly string[]).includes(parts[0]!) &&
    parts.every(
      (p) =>
        /^[\p{L}\p{N}][\p{L}\p{N} _().-]{0,79}$/u.test(p) && !p.includes('..'),
    ) &&
    parts.at(-1)!.endsWith('.md');
  if (!ok) throw new VaultError('Path catatan tidak valid.');
  return parts.join('/');
}

type Memory = AgentInput['memory'];
// Who may do what. Leo may do anything inside the areas; an agent is limited to what its
// memory settings grant, and its own folder is the only place it writes directly.
export function refusal(
  actor: string,
  rel: string,
  mode: 'read' | 'write' | 'propose',
  memory?: Memory,
): string | null {
  if (actor === 'leo')
    return mode === 'propose' ? 'Leo menulis langsung, tanpa usulan.' : null;
  if (!memory) return 'Agent tidak ditemukan.';
  const [area, owner] = rel.split('/');
  const own = area === 'Agents' && owner === actor;
  if (mode === 'write')
    return own && memory.personal
      ? null
      : 'Agent hanya boleh menulis langsung ke memori pribadinya. Ajukan usulan untuk memori bersama.';
  if (mode === 'propose')
    return SHARED_AREAS.includes(area!) && memory.sharedWriteProposal
      ? null
      : 'Agent tidak diizinkan mengusulkan perubahan ke area ini.';
  if (own)
    return memory.personal ? null : 'Memori pribadi agent ini dinonaktifkan.';
  if (SHARED_AREAS.includes(area!))
    return memory.sharedRead
      ? null
      : 'Agent ini belum diizinkan membaca memori bersama.';
  return 'Area ini tidak bisa dibaca agent.';
}

export function createVault(root: string) {
  const base = resolve(root);
  // Only an existing Obsidian vault is accepted, so a wrong path never gets folders created in it.
  if (!existsSync(join(base, '.obsidian')))
    throw new VaultError(
      'OBSIDIAN_VAULT_PATH bukan vault Obsidian yang sudah ada (folder .obsidian tidak ditemukan).',
      500,
    );
  const realBase = realpathSync(base);

  // The full path of a note, refusing anything whose real location (links included) leaves the vault.
  const locate = (rel: string) => {
    const full = resolve(base, ...rel.split('/'));
    if (!full.startsWith(base + sep))
      throw new VaultError('Path di luar vault.');
    let probe = full;
    while (!existsSync(probe)) probe = dirname(probe);
    const real = realpathSync(probe);
    if (real !== realBase && !real.startsWith(realBase + sep))
      throw new VaultError('Path di luar vault.');
    return full;
  };

  const backup = (rel: string, full: string) => {
    const dir = join(base, BACKUP_DIR);
    mkdirSync(dir, { recursive: true });
    const stem = rel.replaceAll('/', '__');
    copyFileSync(full, join(dir, `${stem}.${Date.now()}.bak`));
    const old = readdirSync(dir)
      .filter((f) => f.startsWith(`${stem}.`))
      .sort();
    for (const f of old.slice(0, Math.max(0, old.length - MAX_BACKUPS)))
      unlinkSync(join(dir, f));
  };

  const self = {
    root: base,
    read(rel: string) {
      const full = locate(cleanPath(rel));
      if (!existsSync(full) || !statSync(full).isFile())
        throw new VaultError('Catatan tidak ditemukan.', 404);
      const content = readFileSync(full, 'utf8');
      return { content, hash: hashOf(content) };
    },
    // Hash of the note now, or null when it does not exist yet.
    hashNow(rel: string) {
      const full = locate(cleanPath(rel));
      return existsSync(full) ? hashOf(readFileSync(full, 'utf8')) : null;
    },
    // `expected` is the hash the writer last saw (null for a new note). A changed or already
    // existing note is a conflict, never an overwrite. Notes are written to a temp file and
    // renamed, so a crash cannot leave half a note, and the old text is backed up first.
    write(rel: string, content: string, expected: string | null) {
      const clean = cleanPath(rel);
      checkContent(content);
      const full = locate(clean);
      const exists = existsSync(full);
      const current = exists ? hashOf(readFileSync(full, 'utf8')) : null;
      if (current !== expected)
        throw new VaultError(
          exists
            ? 'Catatan sudah berubah. Baca ulang lalu coba lagi.'
            : 'Catatan yang dimaksud belum ada.',
          409,
        );
      if (exists) backup(clean, full);
      mkdirSync(dirname(full), { recursive: true });
      const temp = join(dirname(full), `.tmp-${randomUUID()}`);
      try {
        writeFileSync(temp, content, { flag: 'wx' });
        renameSync(temp, full);
      } catch (error) {
        if (existsSync(temp)) unlinkSync(temp);
        throw error;
      }
      return { created: !exists, hash: hashOf(content) };
    },
    // Adds the standard folders and a short README in each; nothing existing is touched.
    init(agentIds: string[]) {
      const made: string[] = [];
      const readme = (rel: string, text: string) => {
        const full = locate(rel);
        if (existsSync(full)) return;
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, text, { flag: 'wx' });
        made.push(rel);
      };
      const purpose: Record<Area, string> = {
        Agents:
          'Memori pribadi tiap agent. Setiap agent hanya menulis di folder miliknya.',
        Shared:
          'Pengetahuan bersama. Semua agent boleh membaca; perubahan lewat usulan yang disetujui Leo.',
        Strategy:
          'Strategi dan rencana jangka panjang. Perubahan lewat usulan yang disetujui Leo.',
        Campaigns:
          'Catatan campaign: hasil, pelajaran, evaluasi. Perubahan lewat usulan yang disetujui Leo.',
        Decisions:
          'Keputusan penting dan alasannya. Perubahan lewat usulan yang disetujui Leo.',
        Logs: 'Catatan otomatis dari server. Jangan diedit manual.',
      };
      for (const area of AREAS)
        readme(
          `${area}/README.md`,
          `# ${area}\n\n${purpose[area]}\n\nJangan menyimpan kunci API, kata sandi, atau token di sini.\n`,
        );
      for (const id of agentIds)
        readme(
          `Agents/${id}/README.md`,
          `# Memori ${id}\n\nCatatan pribadi agent ${id}: pelajaran, kesalahan, solusi yang berhasil.\n`,
        );
      return made;
    },
    // Markdown notes under an optional prefix, newest first. Hidden files and backups are skipped.
    list(prefix = '') {
      const out: { path: string; size: number; modified: number }[] = [];
      const walk = (dir: string, rel: string) => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
          const child = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) walk(join(dir, entry.name), child);
          else if (entry.name.endsWith('.md')) {
            const s = statSync(join(dir, entry.name));
            out.push({ path: child, size: s.size, modified: s.mtimeMs });
          }
        }
      };
      for (const area of AREAS)
        if (
          !prefix ||
          prefix.startsWith(area) ||
          area.startsWith(prefix.split('/')[0]!)
        )
          walk(join(base, area), area);
      return out
        .filter((n) => n.path.startsWith(prefix))
        .sort((a, b) => b.modified - a.modified);
    },
    // One line per memory event, appended to Logs/memory-YYYY-MM.md.
    log(line: string) {
      const rel = `Logs/memory-${new Date().toISOString().slice(0, 7)}.md`;
      const full = locate(rel);
      const entry = `- ${new Date().toISOString()} ${line.replaceAll('\n', ' ').slice(0, 300)}\n`;
      const current = existsSync(full)
        ? readFileSync(full, 'utf8')
        : '# Log memori\n\n';
      mkdirSync(dirname(full), { recursive: true });
      const temp = join(dirname(full), `.tmp-${randomUUID()}`);
      writeFileSync(temp, current + entry, { flag: 'wx' });
      renameSync(temp, full);
    },
  };
  return self;
}
export type Vault = ReturnType<typeof createVault>;
