import { useState } from 'react';
import { Face } from '../shell/faces';
import { AgentDrawer, type Tab } from './AgentDrawer';
import { configLabel, runtimeLabel } from './labels';
import { agentActions, useAgents } from './store';

type Open = { id: string | null; tab: Tab } | null;
const cap = (text: string) => text[0]!.toUpperCase() + text.slice(1);

export function AgentsPage() {
  const { status, agents, meta, error } = useAgents();
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState('');

  const counts = {
    total: agents.length,
    configured: agents.filter((a) => a.configStatus === 'configured').length,
    connected: agents.filter((a) =>
      ['ready', 'running', 'paused'].includes(a.runtime.status),
    ).length,
    running: agents.filter((a) => a.runtime.status === 'running').length,
  };
  const toggle = async (id: string, enabled: boolean) => {
    setNotice('');
    const outcome = await agentActions.setEnabled(id, enabled);
    if (outcome) setNotice(outcome.error);
  };
  const current = open?.id
    ? (agents.find((a) => a.id === open.id) ?? null)
    : null;

  return (
    <section className="team-page">
      <div className="section-heading">
        <h2>Tim 204.</h2>
        <button
          className="button button-dark"
          disabled={!meta}
          onClick={() => setOpen({ id: null, tab: 'overview' })}
        >
          + Add Agent
        </button>
      </div>

      {status === 'loading' && (
        <p className="section-note" role="status">
          Memuat agent…
        </p>
      )}
      {status === 'error' && (
        <div className="stats-empty" role="alert">
          <p>Agent tidak bisa dimuat: {error}</p>
          <button className="button" onClick={() => void agentActions.load()}>
            Coba lagi
          </button>
        </div>
      )}

      {status === 'ready' && meta && (
        <>
          <dl className="agent-counts">
            <div>
              <dt>Total agent</dt>
              <dd>{counts.total}</dd>
            </div>
            <div>
              <dt>Terkonfigurasi</dt>
              <dd>{counts.configured}</dd>
            </div>
            <div>
              <dt>Terhubung</dt>
              <dd>{counts.connected}</dd>
            </div>
            <div>
              <dt>Berjalan</dt>
              <dd>{counts.running}</dd>
            </div>
          </dl>
          {!meta.engine.available && (
            <p className="section-note" role="status">
              {meta.engine.message} Konfigurasi disimpan, tetapi belum ada agent
              yang menjalankan pekerjaan.
            </p>
          )}
          {notice && (
            <p className="field-error" role="alert">
              {notice}
            </p>
          )}
          {agents.length === 0 ? (
            <div className="stats-empty">
              <p>Belum ada agent. Tambahkan yang pertama.</p>
            </div>
          ) : (
            <ul className="agent-grid">
              {agents.map((a) => (
                <li
                  key={a.id}
                  className={`agent-card${a.runtime.status === 'disabled' ? ' off' : ''}`}
                >
                  <button
                    className="agent-main"
                    onClick={() => setOpen({ id: a.id, tab: 'overview' })}
                    aria-label={`Lihat detail ${a.config.displayName}`}
                  >
                    <Face
                      name={
                        a.config.avatar
                          ? cap(a.config.avatar)
                          : a.config.displayName
                      }
                    />
                    <span className="member-copy">
                      <strong>{a.config.displayName}</strong>
                      <span>{a.config.role}</span>
                      <small>{a.config.department}</small>
                    </span>
                  </button>
                  <div className="status-row">
                    <span className={`chip ${a.configStatus}`}>
                      {configLabel[a.configStatus]}
                    </span>
                    <span className={`chip ${a.runtime.status}`}>
                      {runtimeLabel[a.runtime.status]}
                    </span>
                  </div>
                  <div className="task-actions">
                    <button
                      className="button"
                      onClick={() => setOpen({ id: a.id, tab: 'ai' })}
                    >
                      Edit
                    </button>
                    <button
                      className="button"
                      onClick={() => void toggle(a.id, !a.config.enabled)}
                    >
                      {a.config.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="owner-note">
            <Face name="Leo" className="owner-avatar" />
            <div>
              <strong>Leo · CEO manusia</strong>
              <p>
                Pemilik, pemberi arahan, dan pengambil keputusan akhir. Leo
                bukan AI Agent.
              </p>
            </div>
          </div>
        </>
      )}

      {open && meta && (open.id === null || current) && (
        <AgentDrawer
          key={open.id ?? 'new'}
          agent={current}
          all={agents}
          meta={meta}
          initialTab={open.tab}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
