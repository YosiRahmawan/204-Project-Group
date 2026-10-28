import { useState } from 'react';
import { BACKGROUND_PRESETS } from '@204/contracts';
import { request } from '../tasks/store';
import { fileUrl, type useStudioData } from './studioData';

const KINDS = [
  {
    id: 'product',
    label: 'Foto / video produk',
    accept: 'image/png,image/jpeg,image/webp,video/mp4,video/webm',
  },
  {
    id: 'presenter',
    label: 'Foto presenter',
    accept: 'image/png,image/jpeg,image/webp',
  },
  {
    id: 'background',
    label: 'Latar sendiri',
    accept: 'image/png,image/jpeg,image/webp',
  },
  { id: 'music', label: 'Musik (berlisensi)', accept: 'audio/mpeg,audio/wav' },
] as const;
const kindLabel = (id: string) =>
  KINDS.find((k) => k.id === id)?.label ?? (id === 'export' ? 'Video' : id);
const size = (bytes: number) =>
  bytes > 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.round(bytes / 1000)} KB`;

type Media = ReturnType<typeof useStudioData>;

// Not-ready states shared by the screens that need the media folder and FFmpeg.
export function MediaGate({ media }: { media: Media }) {
  const { status } = media;
  if (!status)
    return (
      <p className="section-note" role="status">
        Memeriksa FFmpeg…
      </p>
    );
  if (status.configured && status.ffmpeg.available) return null;
  return (
    <div className="stats-empty" role="status">
      <p>
        {!status.configured
          ? 'Folder media belum diatur. Tambahkan MEDIA_DIR ke file .env (contoh: E:/204 Project Media), lalu restart server.'
          : 'FFmpeg tidak ditemukan. Pasang FFmpeg atau isi FFMPEG_PATH di .env.'}
      </p>
    </div>
  );
}

// Uploads, backdrops and the 9:16 tidy-up for one campaign. Originals are never changed.
export function AssetManager({
  campaignId,
  media,
}: {
  campaignId: string;
  media: Media;
}) {
  const { status, assets, reload } = media;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [brightness, setBrightness] = useState(0);

  if (!status?.configured || !status.ffmpeg.available)
    return <MediaGate media={media} />;

  const act = async (work: () => ReturnType<typeof request<unknown>>) => {
    setBusy(true);
    setMessage('');
    const reply = await work();
    setBusy(false);
    if (!reply.ok) setMessage(reply.error);
    else await reload();
  };
  const upload = (kind: string, file: File) =>
    act(() =>
      request('POST', `/campaigns/${campaignId}/assets`, {
        raw: file,
        name: file.name,
        headers: { 'x-asset-kind': kind },
      }),
    );

  return (
    <div className="agent-panel">
      <p className="section-note">
        {status.cost} Disimpan di {status.dir}.
      </p>
      {status.onSystemDrive && (
        <p className="field-error" role="alert">
          Folder media ada di drive C:. Sebaiknya pindahkan ke drive E:.
        </p>
      )}
      <div className="task-actions">
        {KINDS.map((k) => (
          <label key={k.id} className="button">
            + {k.label}
            <input
              type="file"
              hidden
              accept={k.accept}
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
        <legend>Latar polos (dibuat lokal, gratis)</legend>
        <div className="task-actions">
          {BACKGROUND_PRESETS.map((p) => (
            <button
              key={p.id}
              className="button"
              disabled={busy}
              onClick={() =>
                void act(() =>
                  request(
                    'POST',
                    `/campaigns/${campaignId}/assets/background-preset`,
                    { json: { preset: p.id } },
                  ),
                )
              }
            >
              + {p.label}
            </button>
          ))}
        </div>
        <small>
          Latar ruangan yang realistis (workspace, kamar, toko) perlu foto
          unggahan Anda atau gambar AI di fase berikutnya.
        </small>
      </fieldset>
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
      {message && (
        <small className="field-error" role="alert">
          {message}
        </small>
      )}

      {assets.length === 0 ? (
        <div className="stats-empty">
          <p>Belum ada aset. Unggah foto atau video produk dulu.</p>
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
                  {a.seconds && !a.mime.startsWith('image/')
                    ? ` · ${a.seconds.toFixed(1)} dtk`
                    : ''}
                </div>
              </div>
              <div className="task-actions">
                {a.mime.startsWith('image/') && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        request(
                          'POST',
                          `/campaigns/${campaignId}/assets/${a.id}/fit`,
                          { json: { fit, rotate, brightness } },
                        ),
                      )
                    }
                  >
                    Rapikan 9:16
                  </button>
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
                          `/campaigns/${campaignId}/assets/${a.id}`,
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
    </div>
  );
}
