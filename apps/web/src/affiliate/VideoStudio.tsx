import { useCallback, useEffect, useState } from 'react';
import type { CampaignView } from '@204/contracts';
import { refreshers, request } from '../tasks/store';

type Asset = {
  id: string;
  kind: string;
  name: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  seconds: number | null;
  sourceAssetId: string | null;
};
type Job = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  outputAssetId: string | null;
  error: string | null;
  createdAt: number;
};
type MediaStatus = {
  configured: boolean;
  dir: string | null;
  onSystemDrive: boolean;
  ffmpeg: { available: boolean; version: string };
  limits: { maxVideoSeconds: number };
  cost: string;
};
type Scene = { assetId: string; seconds: number; text: string };

const KINDS = [
  { id: 'product', label: 'Foto produk' },
  { id: 'presenter', label: 'Foto presenter' },
  { id: 'background', label: 'Latar' },
  { id: 'music', label: 'Musik (berlisensi)' },
] as const;
const kindLabel = (id: string) =>
  KINDS.find((k) => k.id === id)?.label ?? (id === 'export' ? 'Video' : id);
const size = (bytes: number) =>
  bytes > 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.round(bytes / 1000)} KB`;
const fileUrl = (id: string) => `/api/media/${id}/file`;

export function VideoStudio({ campaign }: { campaign: CampaignView }) {
  const [status, setStatus] = useState<MediaStatus | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [transition, setTransition] = useState<'none' | 'fade'>('fade');
  const [motion, setMotion] = useState<'none' | 'zoom'>('zoom');
  const [musicId, setMusicId] = useState('');
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [brightness, setBrightness] = useState(0);

  // Reads everything first and sets state afterwards, in one place.
  const load = useCallback(
    () =>
      (async () => {
        const s = await request<MediaStatus>('GET', '/media/status');
        if (!s.ok) return null;
        if (!s.data.configured)
          return { status: s.data, assets: null, jobs: null };
        const [a, j] = await Promise.all([
          request<{ assets: Asset[] }>(
            'GET',
            `/campaigns/${campaign.id}/assets`,
          ),
          request<{ jobs: Job[] }>(
            'GET',
            `/campaigns/${campaign.id}/render-jobs`,
          ),
        ]);
        return {
          status: s.data,
          assets: a.ok ? a.data.assets : null,
          jobs: j.ok ? j.data.jobs : null,
        };
      })().then((data) => {
        if (!data) return;
        setStatus(data.status);
        if (data.assets) setAssets(data.assets);
        if (data.jobs) setJobs(data.jobs);
      }),
    [campaign.id],
  );

  useEffect(() => {
    // The server announces every change; this also refreshes the export progress.
    const refresh = () => void load();
    refresh();
    refreshers.add(refresh);
    return () => void refreshers.delete(refresh);
  }, [load]);
  const active = jobs.some(
    (j) => j.status === 'queued' || j.status === 'running',
  );
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  const images = assets.filter((a) => a.mime.startsWith('image/'));
  const music = assets.filter((a) => a.kind === 'music');
  const total = scenes.reduce((sum, s) => sum + s.seconds, 0);

  const upload = async (kind: string, file: File) => {
    setBusy(true);
    setMessage('');
    const reply = await request('POST', `/campaigns/${campaign.id}/assets`, {
      raw: file,
      name: file.name,
      headers: { 'x-asset-kind': kind },
    });
    setBusy(false);
    if (!reply.ok) setMessage(reply.error);
    else await load();
  };
  const act = async (work: () => ReturnType<typeof request<unknown>>) => {
    setBusy(true);
    setMessage('');
    const reply = await work();
    setBusy(false);
    if (!reply.ok) setMessage(reply.error);
    else await load();
    return reply.ok;
  };
  const exportVideo = async () => {
    const ok = await act(() =>
      request('POST', `/campaigns/${campaign.id}/render`, {
        json: {
          scenes,
          transition,
          motion,
          musicAssetId: musicId || null,
        },
      }),
    );
    if (ok) setMessage('Ekspor dimulai. Prosesnya berjalan di laptop Anda.');
  };

  if (!status)
    return (
      <p className="section-note" role="status">
        Memeriksa FFmpeg…
      </p>
    );
  if (!status.configured || !status.ffmpeg.available)
    return (
      <div className="stats-empty" role="status">
        <p>
          {!status.configured
            ? 'Folder media belum diatur. Tambahkan MEDIA_DIR ke file .env (contoh: E:/204 Project Media), lalu restart server.'
            : 'FFmpeg tidak ditemukan. Pasang FFmpeg atau isi FFMPEG_PATH di .env.'}
        </p>
      </div>
    );

  return (
    <div className="agent-panel">
      <p className="section-note">
        {status.cost} Disimpan di {status.dir}. {status.ffmpeg.version}
      </p>
      {status.onSystemDrive && (
        <p className="field-error" role="alert">
          Folder media ada di drive C:. Sebaiknya pindahkan ke drive E:.
        </p>
      )}

      <h3 className="drawer-h3">1. Aset</h3>
      <div className="task-actions">
        {KINDS.map((k) => (
          <label key={k.id} className="button">
            + {k.label}
            <input
              type="file"
              hidden
              accept={
                k.id === 'music'
                  ? 'audio/mpeg,audio/wav'
                  : 'image/png,image/jpeg,image/webp'
              }
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void upload(k.id, file);
              }}
            />
          </label>
        ))}
      </div>
      <fieldset className="check-group">
        <legend>Rapikan foto ke 9:16 (salinan baru, aslinya aman)</legend>
        <div className="field-pair">
          <label className="field">
            <span>Cara pas</span>
            <select
              value={fit}
              onChange={(e) => setFit(e.target.value as typeof fit)}
            >
              <option value="cover">Isi layar (dipotong)</option>
              <option value="contain">Utuh dengan latar buram</option>
            </select>
          </label>
          <label className="field">
            <span>Putar</span>
            <select
              value={rotate}
              onChange={(e) =>
                setRotate(Number(e.target.value) as typeof rotate)
              }
            >
              <option value={0}>0°</option>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Kecerahan: {brightness.toFixed(2)}</span>
          <input
            type="range"
            min={-0.3}
            max={0.3}
            step={0.05}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
          />
        </label>
      </fieldset>

      {assets.length === 0 ? (
        <div className="stats-empty">
          <p>Belum ada aset. Unggah foto produk dulu.</p>
        </div>
      ) : (
        <ul className="agent-grid">
          {assets.map((a) => (
            <li key={a.id} className="agent-card">
              {a.mime.startsWith('image/') && (
                <img
                  className="asset-thumb"
                  src={fileUrl(a.id)}
                  alt={a.name}
                  loading="lazy"
                />
              )}
              {a.mime.startsWith('video/') && (
                <video
                  className="asset-thumb"
                  src={fileUrl(a.id)}
                  controls
                  preload="metadata"
                />
              )}
              <div>
                <strong>{a.name}</strong>
                <div className="section-note">
                  {kindLabel(a.kind)} · {size(a.bytes)}
                  {a.width ? ` · ${a.width}×${a.height}` : ''}
                  {a.mime.startsWith('video/') || a.kind === 'music'
                    ? a.seconds
                      ? ` · ${a.seconds.toFixed(1)} dtk`
                      : ''
                    : ''}
                </div>
              </div>
              <div className="task-actions">
                {a.mime.startsWith('image/') && (
                  <>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        void act(() =>
                          request(
                            'POST',
                            `/campaigns/${campaign.id}/assets/${a.id}/fit`,
                            {
                              json: { fit, rotate, brightness },
                            },
                          ),
                        )
                      }
                    >
                      Rapikan 9:16
                    </button>
                    <button
                      className="button"
                      onClick={() =>
                        setScenes((s) => [
                          ...s,
                          { assetId: a.id, seconds: 3, text: '' },
                        ])
                      }
                    >
                      + Scene
                    </button>
                  </>
                )}
                {a.mime.startsWith('video/') && (
                  <a className="button" href={fileUrl(a.id)} download>
                    Unduh
                  </a>
                )}
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Sembunyikan ${a.name}? Filenya tetap ada di disk.`,
                      )
                    )
                      void act(() =>
                        request(
                          'DELETE',
                          `/campaigns/${campaign.id}/assets/${a.id}`,
                        ),
                      );
                  }}
                >
                  Sembunyikan
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="drawer-h3">2. Scene dan ekspor MP4 9:16</h3>
      {scenes.length === 0 && (
        <p className="section-note">
          Klik &quot;+ Scene&quot; pada sebuah foto untuk menyusun video.
        </p>
      )}
      {scenes.map((scene, i) => (
        <div className="scene" key={i}>
          <strong>Scene {i + 1}</strong>
          <label className="field">
            <span>Foto</span>
            <select
              value={scene.assetId}
              onChange={(e) =>
                setScenes((all) =>
                  all.map((s, j) =>
                    j === i ? { ...s, assetId: e.target.value } : s,
                  ),
                )
              }
            >
              {images.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Teks subtitle</span>
            <input
              value={scene.text}
              maxLength={200}
              onChange={(e) =>
                setScenes((all) =>
                  all.map((s, j) =>
                    j === i ? { ...s, text: e.target.value } : s,
                  ),
                )
              }
            />
          </label>
          <div className="task-actions">
            <input
              type="number"
              min={1}
              max={15}
              aria-label={`Detik scene ${i + 1}`}
              value={scene.seconds}
              onChange={(e) =>
                setScenes((all) =>
                  all.map((s, j) =>
                    j === i
                      ? {
                          ...s,
                          seconds: Math.max(
                            1,
                            Math.min(15, Number(e.target.value) || 1),
                          ),
                        }
                      : s,
                  ),
                )
              }
            />
            <button
              className="button"
              onClick={() => setScenes((all) => all.filter((_, j) => j !== i))}
            >
              Hapus scene
            </button>
          </div>
        </div>
      ))}
      {scenes.length > 0 && (
        <>
          <div className="field-pair">
            <label className="field">
              <span>Transisi</span>
              <select
                value={transition}
                onChange={(e) =>
                  setTransition(e.target.value as typeof transition)
                }
              >
                <option value="fade">Fade</option>
                <option value="none">Tanpa</option>
              </select>
            </label>
            <label className="field">
              <span>Gerak foto</span>
              <select
                value={motion}
                onChange={(e) => setMotion(e.target.value as typeof motion)}
              >
                <option value="zoom">Zoom perlahan</option>
                <option value="none">Diam</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Musik</span>
            <select
              value={musicId}
              onChange={(e) => setMusicId(e.target.value)}
            >
              <option value="">Tanpa musik</option>
              {music.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <small>Hanya musik yang Anda punya lisensinya.</small>
          </label>
          <div className="task-actions">
            <span className="section-note">
              Total {total} dtk (maks. {status.limits.maxVideoSeconds}) · biaya
              Rp0
            </span>
            <button
              className="button button-dark"
              disabled={busy || active || total > status.limits.maxVideoSeconds}
              onClick={() => void exportVideo()}
            >
              {active ? 'Mengekspor…' : 'Ekspor MP4'}
            </button>
          </div>
        </>
      )}
      {message && (
        <small className="drawer-message" role="status">
          {message}
        </small>
      )}

      {jobs.length > 0 && (
        <>
          <h3 className="drawer-h3">Riwayat ekspor</h3>
          <ul className="history-list">
            {jobs.map((j) => (
              <li key={j.id}>
                <span>
                  {new Date(j.createdAt).toLocaleString('id-ID')} ·{' '}
                  {j.status === 'done'
                    ? 'Selesai'
                    : j.status === 'failed'
                      ? `Gagal: ${j.error}`
                      : `${Math.round(j.progress * 100)}%`}
                </span>
                {j.outputAssetId && (
                  <a
                    className="button"
                    href={fileUrl(j.outputAssetId)}
                    download
                  >
                    Unduh MP4
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
