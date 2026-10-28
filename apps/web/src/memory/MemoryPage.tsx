import { useEffect, useState } from 'react';
import { memoryActions, useMemory, type Proposal } from './store';

type Tab = 'proposals' | 'notes';
const AREAS = [
  'Agents',
  'Shared',
  'Strategy',
  'Campaigns',
  'Decisions',
  'Logs',
] as const;

const when = (ms: number) => new Date(ms).toLocaleString('id-ID');

function ProposalCard({ p }: { p: Proposal }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // The note as it is now, so Leo can compare it with what the agent proposes.
  useEffect(() => {
    if (!open || current !== null) return;
    void memoryActions.read(p.path).then((r) => {
      setCurrent('content' in r ? r.content : '(catatan belum ada)');
    });
  }, [open, current, p.path]);

  const decide = async (decision: 'approve' | 'reject') => {
    if (
      decision === 'approve' &&
      !window.confirm(`Tulis usulan ini ke ${p.path} di vault?`)
    )
      return;
    setBusy(true);
    setMessage((await memoryActions.decide(p.id, decision)) ?? '');
    setBusy(false);
  };

  return (
    <li className="agent-card">
      <div>
        <strong>{p.path}</strong>
        <div className="section-note">
          Diusulkan {p.agent} · {when(p.createdAt)}
        </div>
        <p className="section-note">Alasan: {p.reason}</p>
      </div>
      <div className="status-row">
        <span
          className={`chip ${p.status === 'approved' ? 'configured' : p.status === 'rejected' ? 'disabled' : ''}`}
        >
          {p.status === 'pending'
            ? 'Menunggu'
            : p.status === 'approved'
              ? 'Disetujui'
              : 'Ditolak'}
        </span>
        {p.stale && <span className="chip invalid">Catatan sudah berubah</span>}
      </div>
      <button
        className="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Sembunyikan isi' : 'Lihat isi'}
      </button>
      {open && (
        <div className="memory-compare">
          <div>
            <small>Saat ini</small>
            <pre>{current ?? 'Memuat…'}</pre>
          </div>
          <div>
            <small>Usulan</small>
            <pre>{p.content}</pre>
          </div>
        </div>
      )}
      {message && (
        <small className="field-error" role="alert">
          {message}
        </small>
      )}
      {p.status === 'pending' && (
        <div className="task-actions">
          <button
            className="button"
            disabled={busy}
            onClick={() => void decide('reject')}
          >
            Tolak
          </button>
          <button
            className="button button-dark"
            disabled={busy || p.stale}
            title={
              p.stale ? 'Catatan berubah sejak usulan dibuat; tolak saja' : ''
            }
            onClick={() => void decide('approve')}
          >
            Setujui & tulis
          </button>
        </div>
      )}
    </li>
  );
}

function NoteEditor({ path }: { path: string | null }) {
  const [area, setArea] = useState<(typeof AREAS)[number]>('Shared');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [hash, setHash] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Opening an existing note loads it with its hash, which the save must send back.
  useEffect(() => {
    if (!path) return;
    void memoryActions.read(path).then((r) => {
      if ('content' in r) {
        setContent(r.content);
        setHash(r.hash);
        setLoaded(path);
        setMessage('');
      } else setMessage(r.error);
    });
  }, [path]);

  const target = loaded ?? `${area}/${name.trim()}.md`;
  const save = async () => {
    setBusy(true);
    const error = await memoryActions.write(target, content, hash);
    setBusy(false);
    if (error) return setMessage(error);
    const again = await memoryActions.read(target);
    if ('content' in again) {
      setHash(again.hash);
      setLoaded(target);
    }
    setMessage('Tersimpan. Versi lama dicadangkan di .204-backups.');
  };

  return (
    <div className="agent-panel">
      {loaded ? (
        <strong>{loaded}</strong>
      ) : (
        <div className="field-pair">
          <label className="field">
            <span>Area</span>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value as typeof area)}
            >
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Nama catatan</span>
            <input
              value={name}
              maxLength={70}
              placeholder="contoh: aturan-konten"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>
      )}
      <label className="field">
        <span>Isi (Markdown)</span>
        <textarea
          className="prompt-input"
          rows={12}
          value={content}
          maxLength={64000}
          onChange={(e) => setContent(e.target.value)}
        />
        <small>
          Jangan menulis kunci API, kata sandi, atau token; server menolaknya.
        </small>
      </label>
      <div className="drawer-footer">
        <span className="drawer-message" role="status">
          {message}
        </span>
        <div className="task-actions">
          <button
            className="button button-dark"
            disabled={busy || (!loaded && !name.trim())}
            onClick={() => void save()}
          >
            {busy ? 'Menyimpan…' : loaded ? 'Simpan' : 'Buat catatan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MemoryPage() {
  const { loaded, error, status, proposals, notes } = useMemory();
  const [tab, setTab] = useState<Tab>('proposals');
  const [selected, setSelected] = useState<string | null | 'new'>(null);
  const [initMessage, setInitMessage] = useState('');

  const pending = proposals.filter((p) => p.status === 'pending');
  const decided = proposals.filter((p) => p.status !== 'pending');

  return (
    <section className="team-page">
      <div className="section-heading">
        <h2>Memori Obsidian</h2>
        <span className="badge">Tanpa pembelajaran otomatis</span>
      </div>
      <p className="section-note">
        Memori diakses lewat server. Agent menulis langsung hanya ke folder
        pribadinya; perubahan ke area bersama menunggu persetujuan Anda di sini.
      </p>

      {!loaded && !error && (
        <p className="section-note" role="status">
          Memuat memori…
        </p>
      )}
      {error && (
        <div className="stats-empty" role="alert">
          <p>{error}</p>
          <button className="button" onClick={() => void memoryActions.load()}>
            Coba lagi
          </button>
        </div>
      )}

      {status && !status.configured && (
        <div className="stats-empty" role="status">
          <p>
            Memori belum aktif. Tambahkan <code>OBSIDIAN_VAULT_PATH</code> ke
            file <code>.env</code> (isi dengan folder vault Obsidian yang sudah
            ada), lalu restart server.
          </p>
        </div>
      )}

      {status?.configured && (
        <>
          <dl className="agent-counts">
            <div>
              <dt>Catatan di vault</dt>
              <dd>{status.notes}</dd>
            </div>
            <div>
              <dt>Usulan menunggu</dt>
              <dd>{pending.length}</dd>
            </div>
          </dl>
          <p className="section-note">
            Vault: {status.vault}. {status.learning.note}
          </p>
          <div className="task-actions">
            <button
              className="button"
              onClick={() =>
                void memoryActions
                  .init()
                  .then((e) =>
                    setInitMessage(
                      e ??
                        'Struktur folder diperiksa; hanya yang belum ada yang ditambahkan.',
                    ),
                  )
              }
            >
              Siapkan struktur folder
            </button>
            {initMessage && (
              <small className="section-note" role="status">
                {initMessage}
              </small>
            )}
          </div>

          <div className="tab-row" role="tablist" aria-label="Bagian memori">
            <button
              role="tab"
              className="tab"
              aria-selected={tab === 'proposals'}
              onClick={() => setTab('proposals')}
            >
              Usulan ({pending.length})
            </button>
            <button
              role="tab"
              className="tab"
              aria-selected={tab === 'notes'}
              onClick={() => setTab('notes')}
            >
              Catatan
            </button>
          </div>

          {tab === 'proposals' && (
            <>
              {pending.length === 0 ? (
                <div className="stats-empty">
                  <p>Tidak ada usulan yang menunggu.</p>
                </div>
              ) : (
                <ul className="agent-grid">
                  {pending.map((p) => (
                    <ProposalCard key={p.id} p={p} />
                  ))}
                </ul>
              )}
              {decided.length > 0 && (
                <>
                  <h3 className="drawer-h3">Sudah diputuskan</h3>
                  <ul className="agent-grid">
                    {decided.map((p) => (
                      <ProposalCard key={p.id} p={p} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {tab === 'notes' && (
            <>
              <div className="task-actions">
                <button className="button" onClick={() => setSelected('new')}>
                  + Catatan baru
                </button>
              </div>
              {selected === null && notes.length === 0 && (
                <div className="stats-empty">
                  <p>Belum ada catatan. Siapkan struktur folder dulu.</p>
                </div>
              )}
              {selected === null && (
                <ul className="history-list">
                  {notes.map((n) => (
                    <li key={n.path}>
                      <span>
                        {n.path}
                        <small> · {when(n.modified)}</small>
                      </span>
                      <button
                        className="button"
                        onClick={() => setSelected(n.path)}
                      >
                        Buka
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selected !== null && (
                <>
                  <button className="button" onClick={() => setSelected(null)}>
                    ← Kembali ke daftar
                  </button>
                  <NoteEditor
                    key={selected}
                    path={selected === 'new' ? null : selected}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
