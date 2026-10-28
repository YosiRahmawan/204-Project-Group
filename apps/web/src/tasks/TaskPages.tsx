import { useState } from 'react';
import { actions, useTasks } from './store';
import {
  accept,
  checkFiles,
  formatSize,
  maxFiles,
  type Attachment,
  type Decision,
  type Status,
  type Task,
} from '@204/contracts';

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
// Board columns, left to right; one column can hold more than one status.
const columns: { id: string; title: string; statuses: Status[] }[] = [
  { id: 'masuk', title: 'Masuk', statuses: ['dikirim'] },
  { id: 'analisis', title: 'Dianalisis', statuses: ['analisis'] },
  { id: 'kerja', title: 'Dikerjakan', statuses: ['dikerjakan', 'revisi'] },
  { id: 'review', title: 'Review', statuses: ['review', 'menunggu-approval'] },
  { id: 'selesai', title: 'Selesai', statuses: ['selesai', 'ditolak'] },
];
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

// Runs a server action and keeps the button disabled until it has answered.
function usePending() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (work: () => Promise<string | null>) => {
    setPending(true);
    void work().then((problem) => {
      setError(problem);
      setPending(false);
    });
  };
  return { pending, error, run };
}

function StepButton({ number, from }: { number: number; from: Status }) {
  const { pending, error, run } = usePending();
  return (
    <>
      <button
        className="button"
        disabled={pending}
        onClick={() => run(() => actions.advance(number, from))}
      >
        Langkah berikutnya (simulasi)
      </button>
      <Message text={error} />
    </>
  );
}

function AttachmentList({
  items,
  onRemove,
}: {
  items: Attachment[];
  onRemove?: (index: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="attachment-list">
      {items.map((item, index) => (
        <li key={`${item.name}-${index}`} className="attachment">
          {item.type.startsWith('image/') ? (
            <a
              href={`/api/files/${item.id}`}
              target="_blank"
              rel="noreferrer"
              title={`Buka ${item.name}`}
            >
              <img
                src={`/api/files/${item.id}`}
                alt={`Pratinjau ${item.name}`}
              />
            </a>
          ) : (
            <a
              className="attachment-icon"
              href={`/api/files/${item.id}`}
              title={`Unduh ${item.name}`}
            >
              {item.type.split('/')[1]?.slice(0, 4).toUpperCase() ?? 'FILE'}
            </a>
          )}
          <span className="attachment-name">
            {item.name}
            <small>{formatSize(item.size)}</small>
          </span>
          {onRemove && (
            <button
              type="button"
              className="attachment-remove"
              aria-label={`Hapus ${item.name}`}
              onClick={() => onRemove(index)}
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function AttachmentPicker({
  items,
  setItems,
  setProblem,
}: {
  items: Attachment[];
  setItems: (next: Attachment[]) => void;
  setProblem: (message: string | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  // The browser only pre-checks; the server decides from the file's real content.
  const add = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    const { accepted, errors } = checkFiles(items.length, files);
    setProblem(errors.length ? errors.join(' ') : null);
    setUploading(true);
    const results = await Promise.all(
      accepted.map((index) => actions.upload(files[index]!)),
    );
    setUploading(false);
    const added = results.flatMap((r) =>
      'attachment' in r ? [r.attachment] : [],
    );
    const refused = results.flatMap((r) => ('error' in r ? [r.error] : []));
    if (refused.length) setProblem([...errors, ...refused].join(' '));
    setItems([...items, ...added]);
  };
  return (
    <div
      className={dragging ? 'dropzone dragging' : 'dropzone'}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        add(event.dataTransfer.files);
      }}
    >
      <label className="button" htmlFor="attachments">
        Lampirkan foto, dokumen, atau media
      </label>
      <input
        id="attachments"
        className="visually-hidden"
        type="file"
        multiple
        accept={accept}
        onChange={(event) => {
          add(event.target.files);
          event.target.value = '';
        }}
      />
      <span className="subtle-label">
        atau seret file ke sini · maks {maxFiles} file, 10 MB per file ·
        disimpan di server
        {uploading && ' · mengunggah…'}
      </span>
      <AttachmentList
        items={items}
        onRemove={(index) => setItems(items.filter((_, i) => i !== index))}
      />
    </div>
  );
}

export function TaskBoard() {
  const tasks = useTasks();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  return (
    <section className="task-page">
      <div className="section-heading">
        <h2>Task board</h2>
        <span className="badge">Simulasi · tanpa AI</span>
      </div>
      <p className="section-note">
        Task dan lampiran tersimpan di server (database SQLite) dan bertahan
        saat halaman dimuat ulang. Langkah-langkahnya masih simulasi: belum ada
        AI yang mengerjakannya.
      </p>
      <form
        className="task-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (sending) return;
          setSending(true);
          void actions.create(text, files).then((problem) => {
            setSending(false);
            setError(problem);
            if (!problem) {
              setText('');
              setFiles([]);
            }
          });
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
        <AttachmentPicker
          items={files}
          setItems={setFiles}
          setProblem={setError}
        />
        <button className="button button-dark" type="submit" disabled={sending}>
          Kirim instruksi (simulasi)
        </button>
        <Message text={error} />
      </form>
      {tasks.length === 0 ? (
        <p className="section-note" role="status">
          Belum ada task. Kirim instruksi pertama untuk melihat alurnya.
        </p>
      ) : (
        <div className="kanban" role="list" aria-label="Papan task">
          {columns.map((column) => {
            const inColumn = tasks.filter((task) =>
              column.statuses.includes(task.status),
            );
            return (
              <section
                key={column.id}
                className="kanban-column"
                role="listitem"
                aria-label={`${column.title}, ${inColumn.length} task`}
              >
                <h3>
                  {column.title} <span>{inColumn.length}</span>
                </h3>
                {inColumn.length === 0 ? (
                  <p className="panel-empty">Kosong</p>
                ) : (
                  <ul className="kanban-cards">
                    {inColumn.map((task) => (
                      <li className="kanban-card" key={task.id}>
                        <div className="task-top">
                          <strong>{task.id}</strong>
                          {column.statuses.length > 1 && (
                            <span className="badge">
                              {statusLabel[task.status]}
                            </span>
                          )}
                        </div>
                        <p className="kanban-title">{task.instruction}</p>
                        <AttachmentList items={task.attachments} />
                        <p className="subtle-label">
                          {task.owner ?? 'Belum dibagikan'}
                          {task.version > 0 && ` · v${task.version}`}
                          {task.status === 'revisi' &&
                            ` · ${task.revisionReason}`}
                        </p>
                        {task.status === 'menunggu-approval' ? (
                          <a className="text-link" href="#/approvals">
                            Putuskan →
                          </a>
                        ) : (
                          !finished(task) && (
                            <StepButton
                              number={task.number}
                              from={task.status}
                            />
                          )
                        )}
                        <History task={task} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Decide({ task }: { task: Task }) {
  const [reason, setReason] = useState('');
  const { pending, error, run: act } = usePending();
  const run = (decision: Decision) =>
    act(() => actions.decide(task.number, decision, task.version, reason));
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
        <button
          className="button button-dark"
          disabled={pending}
          onClick={() => run('approve')}
        >
          Setujui hasil v{task.version}
        </button>
        <button
          className="button"
          disabled={pending}
          onClick={() => run('revise')}
        >
          Minta revisi
        </button>
        <button
          className="button"
          disabled={pending}
          onClick={() => run('reject')}
        >
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
              <AttachmentList items={task.attachments} />
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
                <AttachmentList items={task.attachments} />
                <History task={task} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
