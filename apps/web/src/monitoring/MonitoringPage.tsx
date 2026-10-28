import { useState } from 'react';
import { useAgents } from '../agents/store';
import { runtimeLabel } from '../agents/labels';
import { monitoringActions, useMonitoring } from './store';

const when = (ms: number) => new Date(ms).toLocaleString('id-ID');

export function MonitoringPage() {
  const { loaded, error, hermes, runs } = useMonitoring();
  const agents = useAgents();
  const akira = agents.agents.find((a) => a.id === 'akira');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const ask = async () => {
    setBusy(true);
    setMessage('');
    const failure = await monitoringActions.ask(text);
    setBusy(false);
    if (failure) setMessage(failure);
    else setText('');
  };

  return (
    <section className="team-page">
      <div className="section-heading">
        <h2>Monitoring AI</h2>
        <button
          className="button"
          onClick={() => void monitoringActions.load()}
        >
          Periksa ulang
        </button>
      </div>
      <p className="section-note">
        Hanya status yang diverifikasi server. Biaya tampil &quot;tidak
        tersedia&quot; karena Hermes tidak melaporkan harga.
      </p>

      {!loaded && !error && (
        <p className="section-note" role="status">
          Memeriksa Hermes…
        </p>
      )}
      {error && (
        <div className="stats-empty" role="alert">
          <p>{error}</p>
        </div>
      )}

      {hermes && (
        <>
          <dl className="agent-counts">
            <div>
              <dt>Koneksi Hermes</dt>
              <dd>
                <span
                  className={`chip ${hermes.connected ? 'configured' : 'invalid'}`}
                >
                  {!hermes.configured
                    ? 'Belum diatur'
                    : hermes.connected
                      ? 'Terhubung'
                      : 'Terputus'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Runtime Akira</dt>
              <dd>
                <span className="chip">
                  {akira ? runtimeLabel[akira.runtime.status] : '—'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Eksekusi</dt>
              <dd>{runs.length}</dd>
            </div>
          </dl>
          <p className="section-note">
            {hermes.reason}
            {hermes.connected &&
              ` Model: ${hermes.model ?? '—'}. Tool aktif di Hermes: ${hermes.toolsEnabled.length ? hermes.toolsEnabled.join(', ') : 'tidak ada'}.`}
          </p>
          {akira && akira.runtime.status !== 'ready' && (
            <p className="section-note">{akira.runtime.reason}</p>
          )}
        </>
      )}

      <div className="agent-panel">
        <label className="field">
          <span>Tanya Akira (uji koneksi)</span>
          <textarea
            rows={3}
            value={text}
            maxLength={4000}
            placeholder="Contoh: Siapa kamu dan siapa saja timmu?"
            onChange={(e) => setText(e.target.value)}
          />
          <small>
            Fase 1: Akira hanya menjawab. Perencanaan dan delegasi menyusul di
            fase 2.
          </small>
        </label>
        <div className="task-actions">
          <button
            className="button button-dark"
            disabled={busy || text.trim().length < 2}
            onClick={() => void ask()}
          >
            {busy ? 'Menunggu jawaban Akira…' : 'Kirim ke Akira'}
          </button>
        </div>
        {message && (
          <small className="field-error" role="alert">
            {message}
          </small>
        )}
      </div>

      <h3 className="drawer-h3">Riwayat eksekusi</h3>
      {runs.length === 0 ? (
        <div className="stats-empty">
          <p>Belum ada eksekusi.</p>
        </div>
      ) : (
        <ul className="agent-grid">
          {runs.map((r) => (
            <li key={r.id} className="agent-card">
              <div>
                <strong>{r.instruction.slice(0, 90)}</strong>
                <div className="section-note">{when(r.createdAt)}</div>
              </div>
              <div className="status-row">
                <span
                  className={`chip ${r.status === 'completed' ? 'configured' : r.status === 'failed' ? 'invalid' : ''}`}
                >
                  {r.status === 'completed'
                    ? 'Selesai'
                    : r.status === 'failed'
                      ? 'Gagal'
                      : 'Berjalan'}
                </span>
                <span className="chip">
                  {r.tokens ? `${r.tokens.total} token` : 'token: n/a'}
                </span>
                <span className="chip">biaya: tidak tersedia</span>
                {r.durationMs !== null && (
                  <span className="chip">
                    {(r.durationMs / 1000).toFixed(1)} dtk
                  </span>
                )}
              </div>
              {r.answer && <p className="section-note">{r.answer}</p>}
              {r.error && (
                <small className="field-error" role="alert">
                  {r.error}
                </small>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
