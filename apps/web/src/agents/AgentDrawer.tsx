import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  EXECUTION_MODES,
  RETENTION,
  agentId,
  agentInputSchema,
  checkAgent,
  configStatus as configOf,
  defaultAgents,
  defaultPrompt,
  executionModeLabel,
  normalizeAgent,
  retentionLabel,
  type AgentInput,
  type AgentView,
  type AgentsMeta,
} from '@204/contracts';
import { agentActions } from './store';
import { configLabel, runtimeLabel } from './labels';

export type Tab = 'overview' | 'ai' | 'prompt' | 'tools' | 'memory' | 'limits';
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'ai', label: 'AI Configuration' },
  { id: 'prompt', label: 'System Prompt' },
  { id: 'tools', label: 'Tools & Permissions' },
  { id: 'memory', label: 'Memory' },
  { id: 'limits', label: 'Resource Limits' },
];
// Which tab holds each field, so a refused save can jump to the right place.
const tabOf = (path: string): Tab => {
  const key = path.split('.')[0]!;
  if (
    [
      'provider',
      'model',
      'temperature',
      'maxOutputTokens',
      'executionMode',
    ].includes(key)
  )
    return 'ai';
  if (key === 'systemPrompt') return 'prompt';
  if (['allowedTools', 'permissions', 'approvals'].includes(key))
    return 'tools';
  if (key === 'memory') return 'memory';
  if (key === 'limits') return 'limits';
  return 'overview';
};

const blank = (): AgentInput => ({
  ...defaultAgents[1]!,
  name: '',
  displayName: '',
  avatar: null,
  description: '',
  department: '',
  role: '',
  responsibility: '',
  reportsTo: 'akira',
  systemPrompt: '',
  memory: { ...defaultAgents[1]!.memory, namespace: '' },
});

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

export function AgentDrawer({
  agent,
  all,
  meta,
  initialTab,
  onClose,
}: {
  agent: AgentView | null;
  all: AgentView[];
  meta: AgentsMeta;
  initialTab: Tab;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const creating = agent === null;
  const [draft, setDraft] = useState<AgentInput>(
    () => agent?.config ?? blank(),
  );
  const [tab, setTab] = useState<Tab>(initialTab);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ at: number; prompt: string }[]>([]);
  // What the form started from; the drawer is closed after a successful save, so it never changes.
  const [baseline] = useState(() => JSON.stringify(agent?.config ?? blank()));
  const dirty = JSON.stringify(draft) !== baseline;
  const catalog = useMemo(() => ({ providers: meta.providers }), [meta]);
  const provider = meta.providers.find((p) => p.id === draft.provider);
  const model = provider?.models.find((m) => m.id === draft.model);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (tab === 'prompt' && agent)
      void agentActions.history(agent.id).then(setHistory);
  }, [tab, agent]);

  const set = <K extends keyof AgentInput>(key: K, value: AgentInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setPermission = (id: string, on: boolean) =>
    setDraft((d) => ({
      ...d,
      permissions: { ...d.permissions, [id]: on },
      // A tool cannot stay on once the permission it needs is switched off.
      allowedTools: on
        ? d.allowedTools
        : d.allowedTools.filter(
            (t) => meta.tools.find((x) => x.id === t)?.needs !== id,
          ),
    }));
  const toggle = (list: string[], id: string, on: boolean) =>
    on ? [...new Set([...list, id])] : list.filter((x) => x !== id);

  const requestClose = () => {
    if (
      dirty &&
      !window.confirm(
        'Ada perubahan yang belum disimpan. Tutup dan buang perubahan?',
      )
    )
      return;
    dialog.current?.close();
  };

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    const shape = agentInputSchema.safeParse(draft);
    if (!shape.success) {
      for (const issue of shape.error.issues)
        found[issue.path.join('.') || 'config'] ??= issue.message;
      return found;
    }
    const others = all.filter((a) => a.id !== agent?.id);
    for (const issue of checkAgent(normalizeAgent(shape.data), catalog, {
      selfId: agent?.id ?? agentId(draft.name),
      ids: others.map((a) => a.id),
      reportsToOf: Object.fromEntries(
        all.map((a) => [a.id, a.config.reportsTo]),
      ),
    }))
      found[issue.path] ??= issue.message;
    return found;
  };

  const save = async () => {
    const found = validate();
    setErrors(found);
    setMessage('');
    const first = Object.keys(found)[0];
    if (first) {
      setTab(tabOf(first));
      setMessage('Periksa isian yang ditandai.');
      return;
    }
    setSaving(true);
    const outcome = creating
      ? await agentActions.create(draft)
      : await agentActions.save(agent.id, agent.version, draft);
    setSaving(false);
    if (outcome) {
      setErrors(outcome.fields);
      setMessage(outcome.error);
      const bad = Object.keys(outcome.fields)[0];
      if (bad) setTab(tabOf(bad));
      return;
    }
    dialog.current?.close();
  };

  const remove = async () => {
    if (
      !agent ||
      !window.confirm(
        `Hapus agent ${agent.config.displayName}? Data konfigurasinya disimpan di catatan audit.`,
      )
    )
      return;
    const outcome = await agentActions.remove(agent.id);
    if (outcome) setMessage(outcome.error);
    else dialog.current?.close();
  };

  const preview = useMemo(
    () =>
      configOf(normalizeAgent(draft), catalog, {
        selfId: agent?.id ?? agentId(draft.name),
        ids: all.filter((a) => a.id !== agent?.id).map((a) => a.id),
      }),
    [draft, catalog, all, agent],
  );
  const err = (path: string) => errors[path];

  return (
    <dialog
      ref={dialog}
      className="member-dialog agent-drawer"
      aria-labelledby="agent-drawer-title"
      onClose={onClose}
      onCancel={(event) => {
        if (dirty) {
          event.preventDefault();
          requestClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="dialog-body agent-body">
        <div className="dialog-top">
          <span className="eyebrow">
            {creating ? 'AGENT BARU' : 'DETAIL AGENT'}
          </span>
          <button className="button" onClick={requestClose}>
            Tutup <span aria-hidden="true">×</span>
          </button>
        </div>
        <h2 id="agent-drawer-title">
          {creating ? 'Tambah agent' : agent.config.displayName}
        </h2>
        <p className="dialog-role">
          {creating
            ? 'Isi identitas dan konfigurasi. Belum ada AI yang dijalankan.'
            : `${draft.role} · ${draft.department}`}
        </p>

        <div
          className="tab-row"
          role="tablist"
          aria-label="Bagian konfigurasi agent"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="agent-panel"
              className="tab"
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {Object.keys(errors).some((p) => tabOf(p) === t.id) && (
                <span className="tab-flag" aria-label="ada kesalahan">
                  !
                </span>
              )}
            </button>
          ))}
        </div>

        <div
          id="agent-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="agent-panel"
        >
          {tab === 'overview' && (
            <>
              <div className="status-row">
                <span className={`chip ${preview.status}`}>
                  {configLabel[preview.status]}
                </span>
                <span
                  className={`chip ${agent ? agent.runtime.status : 'not_connected'}`}
                >
                  {runtimeLabel[agent ? agent.runtime.status : 'not_connected']}
                </span>
              </div>
              <p className="section-note">
                {agent ? agent.runtime.reason : meta.engine.message}
              </p>
              {preview.issues.length > 0 && (
                <ul className="issue-list">
                  {preview.issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
              <Field
                label="Nama (ID permanen)"
                error={err('name')}
                hint={
                  creating
                    ? 'Tidak bisa diubah setelah dibuat.'
                    : 'ID: ' + agent.id
                }
              >
                <input
                  value={draft.name}
                  disabled={!creating}
                  maxLength={30}
                  onChange={(e) =>
                    // The memory namespace follows the name until it is edited by hand.
                    setDraft((d) => ({
                      ...d,
                      name: e.target.value,
                      memory:
                        d.memory.namespace === agentId(d.name)
                          ? { ...d.memory, namespace: agentId(e.target.value) }
                          : d.memory,
                    }))
                  }
                />
              </Field>
              <Field label="Nama tampilan" error={err('displayName')}>
                <input
                  value={draft.displayName}
                  maxLength={60}
                  onChange={(e) => set('displayName', e.target.value)}
                />
              </Field>
              <div className="field-pair">
                <Field label="Role" error={err('role')}>
                  <input
                    value={draft.role}
                    maxLength={80}
                    onChange={(e) => set('role', e.target.value)}
                  />
                </Field>
                <Field label="Departemen" error={err('department')}>
                  <input
                    value={draft.department}
                    maxLength={60}
                    onChange={(e) => set('department', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Deskripsi" error={err('description')}>
                <textarea
                  rows={3}
                  value={draft.description}
                  maxLength={500}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
              <Field label="Tanggung jawab utama" error={err('responsibility')}>
                <input
                  value={draft.responsibility}
                  maxLength={500}
                  onChange={(e) => set('responsibility', e.target.value)}
                />
              </Field>
              <Field
                label="Melapor ke"
                error={err('reportsTo')}
                hint="Leo adalah CEO manusia, bukan agent."
              >
                <select
                  value={draft.reportsTo}
                  onChange={(e) => set('reportsTo', e.target.value)}
                >
                  <option value="leo">Leo (CEO)</option>
                  {all
                    .filter((a) => a.id !== agent?.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.config.displayName}
                      </option>
                    ))}
                </select>
              </Field>
              <Field
                label="Avatar"
                hint="Foto karakter dipakai bila ada; selain itu tampil inisial."
              >
                <select
                  value={draft.avatar ?? ''}
                  onChange={(e) =>
                    set(
                      'avatar',
                      (e.target.value || null) as AgentInput['avatar'],
                    )
                  }
                >
                  <option value="">Inisial nama</option>
                  {['akira', 'aeri', 'amy', 'kuro', 'mail', 'zegion'].map(
                    (a) => (
                      <option key={a} value={a}>
                        {a[0]!.toUpperCase() + a.slice(1)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => set('enabled', e.target.checked)}
                />
                <span>Agent aktif</span>
              </label>
              {agent && (
                <dl className="settings-list">
                  <div>
                    <dt>Versi konfigurasi</dt>
                    <dd>{agent.version}</dd>
                  </div>
                  <div>
                    <dt>Diubah</dt>
                    <dd>{new Date(agent.updatedAt).toLocaleString('id-ID')}</dd>
                  </div>
                  <div>
                    <dt>Jenis</dt>
                    <dd>{agent.builtIn ? 'Bawaan' : 'Kustom'}</dd>
                  </div>
                </dl>
              )}
            </>
          )}

          {tab === 'ai' && (
            <>
              <p className="section-note">
                {meta.engine.message} Pilihan di sini hanya disimpan sebagai
                konfigurasi.
              </p>
              <Field label="Provider" error={err('provider')}>
                <select
                  value={draft.provider ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      provider: e.target.value || null,
                      model: null,
                      temperature: null,
                    }))
                  }
                >
                  <option value="">Belum dipilih</option>
                  {meta.providers.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.models.length === 0}
                    >
                      {p.label}
                      {p.models.length === 0 ? ' (belum ada model)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Model"
                error={err('model')}
                hint={
                  provider
                    ? provider.keyConfigured
                      ? 'Kunci API provider terpasang di server.'
                      : 'Kunci API provider belum diatur di server (variabel lingkungan).'
                    : 'Pilih provider dulu.'
                }
              >
                <select
                  value={draft.model ?? ''}
                  disabled={!provider}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      model: e.target.value || null,
                      temperature: null,
                    }))
                  }
                >
                  <option value="">Belum dipilih</option>
                  {provider?.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="field-pair">
                <Field
                  label="Temperature"
                  error={err('temperature')}
                  hint={
                    model
                      ? model.supportsTemperature
                        ? '0 sampai 2.'
                        : 'Model ini tidak mendukung temperature.'
                      : 'Pilih model dulu.'
                  }
                >
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={2}
                    disabled={!model?.supportsTemperature}
                    value={draft.temperature ?? ''}
                    onChange={(e) =>
                      set(
                        'temperature',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                  />
                </Field>
                <Field
                  label="Maks. token keluaran"
                  error={err('maxOutputTokens')}
                >
                  <input
                    type="number"
                    min={1}
                    value={draft.maxOutputTokens ?? ''}
                    onChange={(e) =>
                      set(
                        'maxOutputTokens',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                  />
                </Field>
              </div>
              <Field label="Mode eksekusi" error={err('executionMode')}>
                <select
                  value={draft.executionMode}
                  onChange={(e) =>
                    set(
                      'executionMode',
                      e.target.value as AgentInput['executionMode'],
                    )
                  }
                >
                  {EXECUTION_MODES.map((m) => (
                    <option key={m} value={m}>
                      {executionModeLabel[m]}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="section-note">
                Kunci API tidak pernah dikirim ke browser dan tidak bisa diisi
                dari layar ini; atur lewat file .env server.
              </p>
            </>
          )}

          {tab === 'prompt' && (
            <>
              <Field
                label="System prompt"
                error={err('systemPrompt')}
                hint={`${draft.systemPrompt.length} / 8000 karakter`}
              >
                <textarea
                  className="prompt-input"
                  rows={12}
                  value={draft.systemPrompt}
                  maxLength={8000}
                  onChange={(e) => set('systemPrompt', e.target.value)}
                />
              </Field>
              <p className="section-note">
                Prompt hanya mengarahkan gaya kerja. Izin, batas, dan
                persetujuan wajib ditentukan server dan tidak bisa diubah lewat
                prompt.
              </p>
              <div className="task-actions">
                <button
                  className="button"
                  onClick={() => set('systemPrompt', defaultPrompt(draft))}
                >
                  Kembalikan ke default
                </button>
              </div>
              {history.length > 0 && (
                <>
                  <h3 className="drawer-h3">Riwayat versi</h3>
                  <ul className="history-list">
                    {history.map((h) => (
                      <li key={h.at + h.prompt.length}>
                        <span>{new Date(h.at).toLocaleString('id-ID')}</span>
                        <button
                          className="button"
                          onClick={() => set('systemPrompt', h.prompt)}
                        >
                          Pakai
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {tab === 'tools' && (
            <>
              <fieldset className="check-group">
                <legend>Izin (prinsip hak minimum)</legend>
                {meta.permissions.map((p) => (
                  <label className="check" key={p.id}>
                    <input
                      type="checkbox"
                      checked={draft.permissions[p.id] === true}
                      onChange={(e) => setPermission(p.id, e.target.checked)}
                    />
                    <span>
                      {p.label}
                      {p.risky && <em className="risky"> berisiko</em>}
                    </span>
                  </label>
                ))}
                {err('permissions') && (
                  <small className="field-error" role="alert">
                    {err('permissions')}
                  </small>
                )}
              </fieldset>
              <fieldset className="check-group">
                <legend>Alat yang diizinkan</legend>
                {meta.tools.map((t) => (
                  <label className="check" key={t.id}>
                    <input
                      type="checkbox"
                      checked={draft.allowedTools.includes(t.id)}
                      disabled={draft.permissions[t.needs] !== true}
                      onChange={(e) =>
                        set(
                          'allowedTools',
                          toggle(draft.allowedTools, t.id, e.target.checked),
                        )
                      }
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
                <small>
                  Alat baru aktif setelah izin yang dibutuhkan dinyalakan. Belum
                  ada alat yang bisa dijalankan.
                </small>
                {err('allowedTools') && (
                  <small className="field-error" role="alert">
                    {err('allowedTools')}
                  </small>
                )}
              </fieldset>
              <fieldset className="check-group">
                <legend>Persetujuan Leo</legend>
                {meta.mandatoryApprovals.map((a) => (
                  <label className="check" key={a.id}>
                    <input type="checkbox" checked disabled />
                    <span>
                      {a.label}{' '}
                      <em className="risky">wajib, tidak bisa dimatikan</em>
                    </span>
                  </label>
                ))}
                {meta.optionalApprovals.map((a) => (
                  <label className="check" key={a.id}>
                    <input
                      type="checkbox"
                      checked={draft.approvals.includes(a.id)}
                      onChange={(e) =>
                        set(
                          'approvals',
                          toggle(draft.approvals, a.id, e.target.checked),
                        )
                      }
                    />
                    <span>{a.label}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}

          {tab === 'memory' && (
            <>
              <p className="section-note">
                Hanya konfigurasi. Belum terhubung ke Obsidian atau penyimpanan
                memori apa pun.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.memory.personal}
                  onChange={(e) =>
                    set('memory', {
                      ...draft.memory,
                      personal: e.target.checked,
                    })
                  }
                />
                <span>Memori pribadi</span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.memory.sharedRead}
                  onChange={(e) =>
                    set('memory', {
                      ...draft.memory,
                      sharedRead: e.target.checked,
                    })
                  }
                />
                <span>Baca memori bersama</span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.memory.sharedWriteProposal}
                  onChange={(e) =>
                    set('memory', {
                      ...draft.memory,
                      sharedWriteProposal: e.target.checked,
                    })
                  }
                />
                <span>
                  Usul tulis ke memori bersama (harus divalidasi dan disetujui)
                </span>
              </label>
              <Field label="Namespace memori" error={err('memory.namespace')}>
                <input
                  value={draft.memory.namespace}
                  maxLength={40}
                  onChange={(e) =>
                    set('memory', {
                      ...draft.memory,
                      namespace: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Retensi" error={err('memory.retention')}>
                <select
                  value={draft.memory.retention}
                  onChange={(e) =>
                    set('memory', {
                      ...draft.memory,
                      retention: e.target
                        .value as AgentInput['memory']['retention'],
                    })
                  }
                >
                  {RETENTION.map((r) => (
                    <option key={r} value={r}>
                      {retentionLabel[r]}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {tab === 'limits' && (
            <>
              <p className="section-note">
                Batas ini baru ditegakkan saat eksekusi AI tersedia. Nilai 0
                berarti belum ada anggaran.
              </p>
              <Field label="Anggaran token" error={err('limits.tokenBudget')}>
                <input
                  type="number"
                  min={0}
                  value={draft.limits.tokenBudget}
                  onChange={(e) =>
                    set('limits', {
                      ...draft.limits,
                      tokenBudget: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field
                label="Batas biaya (USD)"
                error={err('limits.spendingLimitUsd')}
              >
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.limits.spendingLimitUsd}
                  onChange={(e) =>
                    set('limits', {
                      ...draft.limits,
                      spendingLimitUsd: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field
                label="Task bersamaan maksimum"
                error={err('limits.maxConcurrentTasks')}
              >
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draft.limits.maxConcurrentTasks}
                  onChange={(e) =>
                    set('limits', {
                      ...draft.limits,
                      maxConcurrentTasks: Number(e.target.value),
                    })
                  }
                />
              </Field>
            </>
          )}
        </div>

        <div className="drawer-footer">
          <span className="drawer-message" role="status">
            {message || (dirty ? 'Ada perubahan belum disimpan.' : '')}
          </span>
          <div className="task-actions">
            {agent && !agent.builtIn && (
              <button className="button" onClick={() => void remove()}>
                Hapus
              </button>
            )}
            <button
              className="button"
              disabled={!dirty || saving}
              onClick={() => {
                setDraft(JSON.parse(baseline) as AgentInput);
                setErrors({});
                setMessage('');
              }}
            >
              Buang perubahan
            </button>
            <button
              className="button button-dark"
              disabled={saving || (!creating && !dirty)}
              onClick={() => void save()}
            >
              {saving ? 'Menyimpan…' : creating ? 'Tambah agent' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
