import { useState } from 'react';
import { PRESENTER_STYLES } from '@204/contracts';
import { request } from '../tasks/store';
import { presenterActions, usePresenters } from './presenterStore';

const styleLabel = (id: string) =>
  PRESENTER_STYLES.find((s) => s.id === id)?.label ?? id;

// Reusable presenter profiles. Phase 1 stores the reference photos and the style; it does not
// generate or animate a face, so the photos are used as real photos in a scene.
export function PresenterStudio({
  campaignId,
  mediaReady,
  onUsed,
}: {
  campaignId: string | null;
  mediaReady: boolean;
  onUsed: () => void;
}) {
  const { loaded, presenters } = usePresenters();
  const [name, setName] = useState('');
  const [style, setStyle] = useState('casual');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (work: () => Promise<string | null>) => {
    setBusy(true);
    setMessage('');
    const failure = await work();
    setBusy(false);
    if (failure) setMessage(failure);
    return !failure;
  };
  const create = async () => {
    const ok = await act(() =>
      presenterActions.create({ name, style, notes, consent }),
    );
    if (ok) {
      setName('');
      setNotes('');
      setConsent(false);
    }
  };
  const copyToCampaign = async (photoId: string) => {
    if (!campaignId) return;
    setBusy(true);
    setMessage('');
    const reply = await request(
      'POST',
      `/campaigns/${campaignId}/assets/from-presenter`,
      {
        json: { photoId },
      },
    );
    setBusy(false);
    if (reply.ok) {
      setMessage('Foto disalin ke aset campaign. Pakai di tab Storyboard.');
      onUsed();
    } else setMessage(reply.error);
  };

  return (
    <div className="agent-panel">
      <p className="section-note">
        Profil presenter bisa dipakai ulang di campaign mana pun. Fase 1: foto
        referensi dan gaya disimpan, lalu foto asli dipakai sebagai scene.
        Presenter yang berbicara dan konsistensi wajah antar scene dari AI belum
        aktif (fase 2, dan itu berbayar). Gunakan hanya wajah Anda sendiri atau
        orang yang mengizinkan.
      </p>
      {!mediaReady && (
        <p className="field-error" role="alert">
          Folder media belum diatur (MEDIA_DIR di .env), jadi foto belum bisa
          diunggah.
        </p>
      )}

      <fieldset className="check-group">
        <legend>Profil presenter baru</legend>
        <div className="field-pair">
          <label className="field">
            <span>Nama</span>
            <input
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Gaya</span>
            <select value={style} onChange={(e) => setStyle(e.target.value)}>
              {PRESENTER_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Catatan (opsional)</span>
          <input
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            Wajah ini milik saya, atau pemiliknya mengizinkan dipakai. Konten AI
            akan saya beri label sesuai aturan platform.
          </span>
        </label>
        <div className="task-actions">
          <button
            className="button button-dark"
            disabled={busy || name.trim().length < 2 || !consent}
            onClick={() => void create()}
          >
            Buat profil
          </button>
        </div>
      </fieldset>
      {message && (
        <small className="drawer-message" role="status">
          {message}
        </small>
      )}

      {!loaded ? (
        <p className="section-note" role="status">
          Memuat presenter…
        </p>
      ) : presenters.length === 0 ? (
        <div className="stats-empty">
          <p>Belum ada presenter. Buat profil pertama di atas.</p>
        </div>
      ) : (
        <ul className="agent-grid">
          {presenters.map((p) => (
            <li key={p.id} className="agent-card">
              <div>
                <strong>{p.name}</strong>
                <div className="section-note">
                  {styleLabel(p.style)} · {p.photos.length}/5 foto
                </div>
                {p.notes && <div className="section-note">{p.notes}</div>}
              </div>
              <div className="photo-strip">
                {p.photos.map((photo) => (
                  <figure key={photo.id}>
                    <img
                      className="asset-thumb"
                      src={`/api/presenters/photos/${photo.id}/file`}
                      alt={`${p.name}: ${photo.name}`}
                      loading="lazy"
                    />
                    <div className="task-actions">
                      <button
                        className="button"
                        disabled={busy || !campaignId}
                        title={campaignId ? '' : 'Buka sebuah campaign dulu'}
                        onClick={() => void copyToCampaign(photo.id)}
                      >
                        Pakai di campaign
                      </button>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            presenterActions.removePhoto(p.id, photo.id),
                          )
                        }
                      >
                        Hapus
                      </button>
                    </div>
                  </figure>
                ))}
              </div>
              <div className="task-actions">
                <label className="button">
                  + Foto referensi
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy || !mediaReady || p.photos.length >= 5}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file)
                        void act(() => presenterActions.addPhoto(p.id, file));
                    }}
                  />
                </label>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Sembunyikan presenter ${p.name}? Fotonya tetap ada di disk.`,
                      )
                    )
                      void act(() => presenterActions.remove(p.id));
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
