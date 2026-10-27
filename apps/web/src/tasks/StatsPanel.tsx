import { actions, useTasks } from './store';
import { summarize } from './stats';
import { agents, type Status } from './workflow';

const statusLabel: Record<Status, string> = {
  dikirim: 'Instruksi dikirim',
  analisis: 'Dianalisis Akira',
  dikerjakan: 'Dikerjakan',
  review: 'Review Akira',
  'menunggu-approval': 'Menunggu approval',
  revisi: 'Perlu revisi',
  selesai: 'Selesai',
  ditolak: 'Ditolak',
};

// Horizontal bars with the number printed beside each, so colour is never the only cue.
function Bars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <ul className="bars">
        {rows.map((row) => (
          <li key={row.label}>
            <span className="bar-label">{row.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span
                className="bar-fill"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </span>
            <strong className="bar-value">{row.value}</strong>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function Donut({
  title,
  parts,
}: {
  title: string;
  parts: { label: string; value: number; color: string }[];
}) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const summary = parts.map((p) => `${p.label} ${p.value}`).join(', ');
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <div className="donut-row">
        <svg
          viewBox="0 0 100 100"
          width="132"
          height="132"
          role="img"
          aria-label={`${title}: ${summary}`}
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#ece9e0"
            strokeWidth="14"
          />
          {total > 0 &&
            parts.map((part) => {
              const length = (part.value / total) * circumference;
              const circle = (
                <circle
                  key={part.label}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={part.color}
                  strokeWidth="14"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                />
              );
              offset += length;
              return circle;
            })}
          <text
            x="50"
            y="49"
            textAnchor="middle"
            fontSize="18"
            fontWeight="600"
            fill="#171717"
          >
            {total}
          </text>
          <text x="50" y="62" textAnchor="middle" fontSize="7" fill="#65645f">
            task
          </text>
        </svg>
        <ul className="legend">
          {parts.map((part) => (
            <li key={part.label}>
              <span
                className="swatch"
                style={{ background: part.color }}
                aria-hidden="true"
              />
              {part.label}
              <strong>{part.value}</strong>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function Stats() {
  const tasks = useTasks();
  const s = summarize(tasks);
  return (
    <section className="stats" aria-labelledby="stats-title">
      <div className="section-heading">
        <h2 id="stats-title">Statistik task</h2>
        <span className="badge">Simulasi · tanpa AI</span>
      </div>
      <p className="section-note">
        Dihitung dari task di Task board pada browser ini. Belum ada data nyata
        dari backend atau AI.
      </p>
      {s.total === 0 ? (
        <div className="stats-empty" role="status">
          <p>Belum ada task, jadi belum ada yang bisa dihitung.</p>
          <div className="task-actions">
            <button
              className="button button-dark"
              onClick={() => actions.seed()}
            >
              Muat data contoh
            </button>
            <a className="button" href="#/tasks">
              Buat task sendiri
            </a>
          </div>
        </div>
      ) : (
        <>
          <dl className="kpis">
            <div>
              <dt>Total task</dt>
              <dd>{s.total}</dd>
            </div>
            <div>
              <dt>Sedang berjalan</dt>
              <dd>{s.active}</dd>
            </div>
            <div>
              <dt>Menunggu approval</dt>
              <dd>{s.byStatus['menunggu-approval']}</dd>
            </div>
            <div>
              <dt>Tingkat persetujuan</dt>
              <dd>
                {s.approvalRate === null
                  ? '–'
                  : `${Math.round(s.approvalRate * 100)}%`}
              </dd>
            </div>
            <div>
              <dt>Revisi diminta</dt>
              <dd>{s.revisions}</dd>
            </div>
            <div>
              <dt>Lampiran</dt>
              <dd>{s.attachments}</dd>
            </div>
          </dl>
          <div className="chart-grid">
            <Bars
              title="Task per tahap"
              rows={(Object.keys(statusLabel) as Status[]).map((status) => ({
                label: statusLabel[status],
                value: s.byStatus[status],
              }))}
            />
            <Bars
              title="Beban kerja per agent"
              rows={agents.map((agent) => ({
                label: agent,
                value: s.byOwner[agent],
              }))}
            />
            <Donut
              title="Keputusan Leo"
              parts={[
                { label: 'Disetujui', value: s.approved, color: '#246344' },
                { label: 'Ditolak', value: s.rejected, color: '#9b2c2c' },
                {
                  label: 'Belum diputuskan',
                  value: s.active,
                  color: '#c9a24a',
                },
              ]}
            />
          </div>
          <div className="task-actions">
            <button className="button" onClick={() => actions.seed()}>
              Tambah data contoh
            </button>
            <button className="button" onClick={() => actions.clear()}>
              Hapus semua task
            </button>
          </div>
        </>
      )}
    </section>
  );
}
