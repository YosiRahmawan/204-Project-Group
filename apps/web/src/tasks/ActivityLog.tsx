import { useEffect, useState } from 'react';
import { actions, useTasks } from './store';
import { ago, recentActivity } from './stats';

const filters = [
  { id: 'all', label: 'Semua' },
  { id: 'warn', label: 'Perlu perhatian' },
  { id: 'done', label: 'Disetujui' },
] as const;
type Filter = (typeof filters)[number]['id'];

// Every step of every task, newest first. Orange marks work sent back or rejected.
export function ActivityLog() {
  const tasks = useTasks();
  const [filter, setFilter] = useState<Filter>('all');
  // Relative times refresh every 30 seconds.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const all = recentActivity(tasks, 200);
  const items = all.filter((item) => filter === 'all' || item.kind === filter);
  return (
    <section className="task-page">
      <div className="section-heading">
        <h2>Riwayat &amp; log</h2>
        <span className="badge">Simulasi · tanpa AI</span>
      </div>
      <p className="section-note">
        Apa yang baru terjadi pada task: dikirim, dibagikan, dikerjakan,
        direvisi, atau diputuskan. Berasal dari Task board di browser ini dan
        hilang saat halaman dimuat ulang.
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
          <div className="filter-row" role="group" aria-label="Saring riwayat">
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
    </section>
  );
}
