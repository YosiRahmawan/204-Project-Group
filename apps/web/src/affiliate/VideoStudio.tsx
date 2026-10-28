import { useState } from 'react';
import type { CampaignView } from '@204/contracts';
import { request } from '../tasks/store';
import { MediaGate } from './AssetManager';
import { fileUrl, type useStudioData } from './studioData';

type Media = ReturnType<typeof useStudioData>;

// Exports the saved storyboard as an MP4: the storyboard is the timeline, so scenes are edited
// in the Storyboard tab and only the look of the export is chosen here.
export function VideoStudio({
  campaign,
  media,
}: {
  campaign: CampaignView;
  media: Media;
}) {
  const { status, assets, jobs, active, reload } = media;
  const [transition, setTransition] = useState<'none' | 'fade'>('fade');
  const [motion, setMotion] = useState<'none' | 'zoom'>('zoom');
  const [musicId, setMusicId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!status?.configured || !status.ffmpeg.available)
    return <MediaGate media={media} />;

  const { storyboard } = campaign.config.content;
  const defaultBackground = campaign.config.studio?.backgroundAssetId ?? null;
  const ready = storyboard.filter((s) => s.assetId);
  const total = ready.reduce((sum, s) => sum + s.seconds, 0);
  const missing = storyboard.length - ready.length;
  const music = assets.filter((a) => a.kind === 'music');
  const name = (id: string | null) =>
    assets.find((a) => a.id === id)?.name ?? '—';
  const tooLong = total > status.limits.maxVideoSeconds;
  const lastExport = jobs.find((j) => j.outputAssetId)?.outputAssetId ?? null;

  const exportVideo = async () => {
    setBusy(true);
    setMessage('');
    const reply = await request('POST', `/campaigns/${campaign.id}/render`, {
      json: {
        scenes: ready.map((s) => ({
          assetId: s.assetId,
          backgroundAssetId: s.backgroundAssetId ?? defaultBackground,
          trimStart: s.trimStart,
          seconds: Math.min(15, s.seconds),
          text: s.text,
        })),
        transition,
        motion,
        musicAssetId: musicId || null,
      },
    });
    setBusy(false);
    if (!reply.ok) setMessage(reply.error);
    else {
      setMessage('Ekspor dimulai. Prosesnya berjalan di laptop Anda.');
      await reload();
    }
  };

  return (
    <div className="agent-panel">
      <p className="section-note">
        {status.cost} Scene diambil dari Storyboard yang sudah disimpan.
      </p>
      {storyboard.length === 0 ? (
        <div className="stats-empty">
          <p>Belum ada storyboard. Buat dulu di tab Storyboard.</p>
        </div>
      ) : (
        <>
          <ol className="timeline">
            {storyboard.map((s, i) => (
              <li key={i} className={s.assetId ? '' : 'off'}>
                <strong>Scene {i + 1}</strong> · {s.seconds} dtk ·{' '}
                {s.assetId ? name(s.assetId) : 'belum ada foto'}
                {s.text && <span className="section-note"> · “{s.text}”</span>}
              </li>
            ))}
          </ol>
          {missing > 0 && (
            <p className="section-note">
              {missing} scene belum punya foto atau video dan tidak ikut
              diekspor.
            </p>
          )}
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
            <small>
              Hanya musik yang Anda punya lisensinya. Voice-over AI menyusul di
              fase 2.
            </small>
          </label>
          <div className="task-actions">
            <span className="section-note">
              {ready.length} scene · total {total} dtk (maks.{' '}
              {status.limits.maxVideoSeconds}) · biaya Rp0
            </span>
            <button
              className="button button-dark"
              disabled={busy || active || ready.length === 0 || tooLong}
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
          {lastExport && (
            <video
              className="asset-thumb preview-9-16"
              controls
              preload="metadata"
              src={fileUrl(lastExport)}
            />
          )}
        </>
      )}
    </div>
  );
}
