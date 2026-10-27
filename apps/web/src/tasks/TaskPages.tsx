import { useState } from 'react';
import { actions, useTasks } from './store';
import type { Decision, Status, Task } from './workflow';

const statusLabel: Record<Status, string> = {
  dikirim: 'Instruksi dikirim',
  analisis: 'Dianalisis Akira',
  dikerjakan: 'Dikerjakan',
  review: 'Review Akira',
  'menunggu-approval': 'Menunggu approval Leo',
  revisi: 'Perlu revisi',
  selesai: 'Selesai',
  ditolak: 'Ditolak',
};
const finished = (task: Task) =>
  task.status === 'selesai' || task.status === 'ditolak';

function History({ task }: { task: Task }) {
  return (
    <details className="workflow-details">
      <summary>Riwayat ({task.history.length})</summary>
      <ol className="task-history">
        {task.history.map((entry, index) => (
          <li key={index}>
            <time>{new Date(entry.at).toLocaleTimeString('id-ID')}</time>{' '}
            {entry.text}
          </li>
        ))}
      </ol>
    </details>
  );
}

function Message({ text }: { text: string | null }) {
  return text ? (
    <p className="task-error" role="alert">
      {text}
    </p>
  ) : null;
}

function StepButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button className="button" onClick={() => setError(actions.advance(id))}>
        Jalankan langkah berikutnya (simulasi)
      </button>
      <Message text={error} />
    </>
  );
}

export function TaskBoard() {
  const tasks = useTasks();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="task-page">
      <div className="section-heading">
        <h2>Task board</h2>
        <span className="badge">Simulasi · tanpa AI</span>
      </div>
      <p className="section-note">
        Alur diuji dengan layanan palsu di browser ini. Tidak ada AI atau
        backend yang bekerja, dan data hilang saat halaman dimuat ulang.
      </p>
      <form
        className="task-form"
        onSubmit={(event) => {
          event.preventDefault();
          const problem = actions.create(text);
          setError(problem);
          if (!problem) setText('');
        }}
      >
        <label htmlFor="instruction">Instruksi untuk Akira</label>
        <textarea
          id="instruction"
          value={text}
          rows={3}
          onChange={(event) => setText(event.target.value)}
          placeholder="Contoh: Buat konten Instagram untuk peluncuran produk"
        />
        <button className="button button-dark" type="submit">
          Kirim instruksi (simulasi)
        </button>
        <Message text={error} />
      </form>
      {tasks.length === 0 ? (
        <p className="section-note" role="status">
          Belum ada task. Kirim instruksi pertama untuk melihat alurnya.
        </p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li className="task-card" key={task.id}>
              <div className="task-top">
                <strong>{task.id}</strong>
                <span className="badge">{statusLabel[task.status]}</span>
              </div>
              <p>{task.instruction}</p>
              <p className="subtle-label">
                Pemilik: {task.owner ?? 'belum dibagikan'}
                {task.version > 0 && ` · hasil v${task.version}`}
                {task.status === 'revisi' &&
                  ` · revisi: ${task.revisionReason}`}
              </p>
              {task.status === 'menunggu-approval' ? (
                <a className="text-link" href="#/approvals">
                  Putuskan di Approval inbox →
                </a>
              ) : (
                !finished(task) && <StepButton id={task.id} />
              )}
              <History task={task} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Decide({ task }: { task: Task }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = (decision: Decision) =>
    setError(actions.decide(task.id, decision, task.version, reason));
  return (
    <div className="task-decide">
      <label htmlFor={`reason-${task.id}`}>
        Alasan revisi (wajib untuk revisi)
      </label>
      <input
        id={`reason-${task.id}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="task-actions">
        <button className="button button-dark" onClick={() => run('approve')}>
          Setujui hasil v{task.version}
        </button>
        <button className="button" onClick={() => run('revise')}>
          Minta revisi
        </button>
        <button className="button" onClick={() => run('reject')}>
          Tolak
        </button>
      </div>
      <Message text={error} />
    </div>
  );
}

export function ApprovalInbox() {
  const tasks = useTasks();
  const waiting = tasks.filter((task) => task.status === 'menunggu-approval');
  const done = tasks.filter(finished);
  return (
    <section className="task-page">
      <div className="section-heading">
        <h2>Approval inbox</h2>
        <span className="badge">Simulasi · tanpa AI</span>
      </div>
      <p className="section-note">
        Keputusan hanya berlaku untuk versi hasil yang Anda lihat. Ini simulasi
        di browser, belum otorisasi server.
      </p>
      {waiting.length === 0 ? (
        <p className="section-note" role="status">
          Tidak ada hasil yang menunggu persetujuan.
        </p>
      ) : (
        <ul className="task-list">
          {waiting.map((task) => (
            <li className="task-card" key={`${task.id}-${task.version}`}>
              <div className="task-top">
                <strong>{task.id}</strong>
                <span className="badge">
                  {task.owner} · hasil v{task.version}
                </span>
              </div>
              <p>{task.instruction}</p>
              <Decide task={task} />
              <History task={task} />
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <>
          <h3>Sudah diputuskan</h3>
          <ul className="task-list">
            {done.map((task) => (
              <li className="task-card" key={task.id}>
                <div className="task-top">
                  <strong>{task.id}</strong>
                  <span className="badge">{statusLabel[task.status]}</span>
                </div>
                <p>{task.instruction}</p>
                <History task={task} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
