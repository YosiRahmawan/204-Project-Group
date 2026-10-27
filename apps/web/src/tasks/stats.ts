import {
  agents,
  type Agent,
  type HistoryKind,
  type Status,
  type Task,
} from './workflow';

export type Summary = {
  total: number;
  active: number;
  byStatus: Record<Status, number>;
  byOwner: Record<Agent, number>;
  approved: number;
  rejected: number;
  // Result versions beyond the first: how many times the CEO sent work back.
  revisions: number;
  attachments: number;
  // Approved share of decided tasks, or null while nothing has been decided.
  approvalRate: number | null;
};

const statuses: Status[] = [
  'dikirim',
  'analisis',
  'dikerjakan',
  'review',
  'menunggu-approval',
  'revisi',
  'selesai',
  'ditolak',
];

export function summarize(tasks: Task[]): Summary {
  const byStatus = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<
    Status,
    number
  >;
  const byOwner = Object.fromEntries(agents.map((a) => [a, 0])) as Record<
    Agent,
    number
  >;
  let revisions = 0;
  let attachments = 0;
  for (const task of tasks) {
    byStatus[task.status]++;
    if (task.owner) byOwner[task.owner]++;
    revisions += Math.max(0, task.version - 1);
    attachments += task.attachments.length;
  }
  const approved = byStatus.selesai;
  const rejected = byStatus.ditolak;
  const decided = approved + rejected;
  return {
    total: tasks.length,
    active: tasks.length - decided,
    byStatus,
    byOwner,
    approved,
    rejected,
    revisions,
    attachments,
    approvalRate: decided ? approved / decided : null,
  };
}

export type Activity = {
  taskId: string;
  title: string;
  text: string;
  at: number;
  kind: HistoryKind;
};

// Newest events across all tasks, for the activity feed.
export function recentActivity(tasks: Task[], limit: number): Activity[] {
  return tasks
    .flatMap((task) =>
      task.history.map((h) => ({
        taskId: task.id,
        title: task.instruction,
        text: h.text,
        at: h.at,
        kind: h.kind,
      })),
    )
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

// Tasks that wait for Leo: results to decide on, and revisions he asked for.
export function needsLeo(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status === 'menunggu-approval');
}

// Short relative time such as "baru saja", "5m", "3j", "2h".
export function ago(now: number, at: number): string {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}j` : `${Math.floor(hours / 24)}h`;
}
