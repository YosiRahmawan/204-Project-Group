import { agents, type Agent, type Status, type Task } from './workflow';

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
