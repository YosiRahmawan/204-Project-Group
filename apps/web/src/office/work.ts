import type { Task } from '@204/contracts';

export type Work = { text: string; state: 'working' | 'waiting' | 'idle' };

const active = (task: Task) =>
  task.status !== 'selesai' && task.status !== 'ditolak';
const short = (task: Task) =>
  `${task.id} ${task.instruction.replace(/^\[Contoh\]\s*/, '')}`;

// What a character is doing right now, read from the simulated tasks.
export function workOf(name: string, tasks: Task[]): Work {
  const open = tasks.filter(active);
  if (name === 'Leo') {
    const waiting = open.filter((t) => t.status === 'menunggu-approval').length;
    return waiting
      ? { text: `${waiting} hasil menunggu keputusan`, state: 'waiting' }
      : { text: 'Siap memberi instruksi', state: 'idle' };
  }
  if (name === 'Akira') {
    const task =
      open.find((t) => t.status === 'review') ??
      open.find((t) => t.status === 'analisis') ??
      open.find((t) => t.status === 'dikirim');
    if (!task) return { text: 'Menunggu instruksi', state: 'idle' };
    const verb =
      task.status === 'review'
        ? 'Meninjau'
        : task.status === 'analisis'
          ? 'Menganalisis'
          : 'Menerima';
    return { text: `${verb} ${short(task)}`, state: 'working' };
  }
  const task = open.find(
    (t) =>
      t.owner === name && (t.status === 'dikerjakan' || t.status === 'revisi'),
  );
  if (!task) return { text: 'Menunggu tugas', state: 'idle' };
  return {
    text: `${task.status === 'revisi' ? 'Merevisi' : 'Mengerjakan'} ${short(task)}`,
    state: 'working',
  };
}
