import { useEffect, useState } from 'react';
import { actions, useTasks, type AuditEntry } from './store';
import { ago, recentActivity } from './stats';

const filters = [
  { id: 'all', label: 'Semua' },
  { id: 'warn', label: 'Perlu perhatian' },
  { id: 'done', label: 'Disetujui' },
] as const;
type Filter = (typeof filters)[number]['id'];

// What the server wrote down, in words, and how to colour the dot.
const auditText: Record<string, [string, 'info' | 'warn' | 'done']> = {
  'login.ok': ['Masuk', 'done'],
  'login.bad': ['Gagal masuk: kata sandi salah', 'warn'],
  'login.limited': ['Dikunci: terlalu banyak percobaan masuk', 'warn'],
  logout: ['Keluar', 'info'],
  'task.create': ['Task dibuat', 'info'],
  'task.advance': ['Langkah dijalankan', 'info'],
  'task.approve': ['Hasil disetujui', 'done'],
  'task.revise': ['Revisi diminta', 'warn'],
  'task.reject': ['Hasil ditolak', 'warn'],
  'tasks.demo': ['Data contoh ditambahkan', 'info'],
  'tasks.clear': ['Semua task dihapus', 'warn'],
  'file.upload': ['File diunggah', 'info'],
  'file.refused': ['File ditolak', 'warn'],
};

// Every step of every task, newest first, or the server's permanent audit trail.
export function ActivityLog() {
  const tasks = useTasks();
  const [view, setView] = useState<'tasks' | 'audit'>('tasks');
  const [filter, setFilter] = useState<Filter>('all');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  // Relative times refresh every 30 seconds.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  // The audit trail is re-read whenever the tasks change, which is what makes it grow.
  useEffect(() => {
    if (view === 'audit') void actions.audit().then(setAudit);
  }, [view, tasks]);
  const all = recentActivity(tasks, 200);
  const items = all.filter((item) => filter === 'all' || item.kind === filter);
  return (
    <section className="task-page">
      <div className="section-heading">
        <h2>Riwayat &amp; log</h2>
        <span className="badge">Simulasi · tanpa AI</span>
      </div>
      <div className="filter-row" role="group" aria-label="Jenis riwayat">
        <button
          className="button"
          aria-pressed={view === 'tasks'}
          onClick={() => setView('tasks')}
        >
          Aktivitas task
        </button>
        <button
          className="button"
          aria-pressed={view === 'audit'}
          onClick={() => setView('audit')}
        >
          Catatan audit server
        </button>
      </div>
      {view === 'audit' ? (
        <>
          <p className="section-note">
            Siapa melakukan apa, termasuk percobaan masuk dan file yang ditolak.
            Disimpan permanen di database dan tidak ikut terhapus saat task
            dihapus.
          </p>
          {audit.length === 0 ? (
            <p className="section-note" role="status">
              Belum ada catatan.
            </p>
          ) : (
            <ul className="activity-feed">
              {audit.map((entry) => {
                const [text, kind] = auditText[entry.action] ?? [
                  entry.action,
                  'info',
                ];
                return (
                  <li key={entry.id}>
                    <span className={`dot ${kind}`} aria-hidden="true" />
                    <span className="activity-text">
                      {text}
                      <small>
                        {entry.actor}
                        {entry.detail && ` · ${entry.detail}`}
                      </small>
                    </span>
                    <time
                      className="feed-time"
                      dateTime={new Date(entry.at).toISOString()}
                      title={new Date(entry.at).toLocaleString('id-ID')}
                    >
                      {ago(now, entry.at)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="section-note">
            Apa yang baru terjadi pada task: dikirim, dibagikan, dikerjakan,
            direvisi, atau diputuskan. Tersimpan di server dan ikut terhapus
            bersama task-nya.
          </p>
          {all.length === 0 ? (
            <div className="stats-empty" role="status">
              <p>Belum ada riwayat. Kirim instruksi atau muat data contoh.</p>
              <div className="task-actions">
                <button
                  className="button button-dark"
                  onClick={() => actions.seed()}
                >
                  Muat data contoh
                </button>
                <a className="button" href="#/tasks">
                  Buka Task board
                </a>
              </div>
            </div>
          ) : (
            <>
              <div
                className="filter-row"
                role="group"
                aria-label="Saring riwayat"
              >
                {filters.map((f) => (
                  <button
                    key={f.id}
                    className="button"
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {items.length === 0 ? (
                <p className="section-note" role="status">
                  Tidak ada kejadian pada saringan ini.
                </p>
              ) : (
                <ul className="activity-feed">
                  {items.map((item, index) => (
                    <li key={`${item.taskId}-${item.at}-${index}`}>
                      <span className={`dot ${item.kind}`} aria-hidden="true" />
                      <span className="activity-text">
                        <strong>{item.taskId}</strong> {item.text}
                        <small>{item.title}</small>
                      </span>
                      <time
                        className="feed-time"
                        dateTime={new Date(item.at).toISOString()}
                        title={new Date(item.at).toLocaleString('id-ID')}
                      >
                        {ago(now, item.at)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
