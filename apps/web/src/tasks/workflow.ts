// Simulated task workflow: deterministic, in memory, no backend and no AI.
export const agents = ['Aeri', 'Amy', 'Kuro', 'Mail', 'Zegion'] as const;
export type Agent = (typeof agents)[number];
export type Status =
  | 'dikirim'
  | 'analisis'
  | 'dikerjakan'
  | 'review'
  | 'menunggu-approval'
  | 'revisi'
  | 'selesai'
  | 'ditolak';
export type Decision = 'approve' | 'revise' | 'reject';
export type Task = {
  id: string;
  instruction: string;
  status: Status;
  owner: Agent | null;
  // Bumps every time the owner submits a result; approvals refer to one version.
  version: number;
  revisionReason: string | null;
  history: { at: number; text: string }[];
};
export type Result = { ok: true; task: Task } | { ok: false; error: string };

const ok = (task: Task): Result => ({ ok: true, task });
const fail = (error: string): Result => ({ ok: false, error });

const keywords: [RegExp, Agent][] = [
  [/konten|sosial|instagram|brand/i, 'Aeri'],
  [/pemasaran|iklan|kampanye|marketing/i, 'Amy'],
  [/desain|visual|logo|poster/i, 'Kuro'],
  [/biaya|anggaran|keuangan|budget/i, 'Mail'],
  [/sistem|keamanan|teknis|server/i, 'Zegion'],
];

export function createTask(
  instruction: string,
  sequence: number,
  now: number,
): Result {
  const text = instruction.trim();
  if (!text) return fail('Instruksi tidak boleh kosong.');
  return ok({
    id: `T-${String(sequence).padStart(3, '0')}`,
    instruction: text,
    status: 'dikirim',
    owner: null,
    version: 0,
    revisionReason: null,
    history: [{ at: now, text: 'Leo mengirim instruksi (simulasi).' }],
  });
}

const log = (
  task: Task,
  now: number,
  text: string,
  patch: Partial<Task>,
): Result =>
  ok({
    ...task,
    ...patch,
    history: [...task.history, { at: now, text }],
  });

// One simulated step by Akira or the owner. Only the CEO can decide an approval.
export function advance(task: Task, sequence: number, now: number): Result {
  switch (task.status) {
    case 'dikirim':
      return log(task, now, 'Akira menganalisis instruksi.', {
        status: 'analisis',
      });
    case 'analisis': {
      const owner =
        keywords.find(([pattern]) => pattern.test(task.instruction))?.[1] ??
        agents[sequence % agents.length]!;
      return log(task, now, `Akira membagikan pekerjaan ke ${owner}.`, {
        status: 'dikerjakan',
        owner,
      });
    }
    case 'dikerjakan': {
      const version = task.version + 1;
      return log(task, now, `${task.owner} mengirim hasil v${version}.`, {
        status: 'review',
        version,
      });
    }
    case 'review':
      return log(task, now, `Akira meneruskan hasil v${task.version} ke Leo.`, {
        status: 'menunggu-approval',
      });
    case 'revisi':
      return log(task, now, `${task.owner} mengerjakan revisi.`, {
        status: 'dikerjakan',
      });
    default:
      return fail('Task ini tidak memiliki langkah berikutnya.');
  }
}

const decided = { approve: 'selesai', reject: 'ditolak' } as const;

export function decide(
  task: Task,
  decision: Decision,
  version: number,
  reason: string,
  now: number,
): Result {
  if (task.status !== 'menunggu-approval') {
    // Repeating the same decision on the same result is a no-op, not an error.
    const repeated =
      decision !== 'revise' &&
      task.status === decided[decision] &&
      version === task.version;
    return repeated ? ok(task) : fail('Task tidak sedang menunggu approval.');
  }
  if (version !== task.version)
    return fail(
      `Hasil sudah berubah ke v${task.version}. Tinjau ulang sebelum memutuskan.`,
    );
  if (decision === 'revise') {
    const why = reason.trim();
    if (!why) return fail('Alasan revisi wajib diisi.');
    return log(task, now, `Leo meminta revisi v${version}: ${why}`, {
      status: 'revisi',
      revisionReason: why,
    });
  }
  const text = decision === 'approve' ? 'Leo menyetujui' : 'Leo menolak';
  return log(task, now, `${text} hasil v${version}.`, {
    status: decided[decision],
  });
}
