import { advance, createTask, decide, type Task } from './workflow';

// Sample tasks in every stage, so the statistics can be seen before real use.
const scenarios: [string, number, 'approve' | 'revise' | 'reject' | null][] = [
  ['[Contoh] Buat konten Instagram peluncuran produk', 4, 'approve'],
  ['[Contoh] Kampanye iklan akhir tahun', 4, 'revise'],
  ['[Contoh] Desain poster acara pembukaan', 3, null],
  ['[Contoh] Susun anggaran kuartal empat', 2, null],
  ['[Contoh] Audit keamanan sistem kantor', 4, 'reject'],
  ['[Contoh] Logo variasi untuk kaos tim', 4, null],
  ['[Contoh] Ringkasan laporan keuangan bulanan', 1, null],
  ['[Contoh] Ide konten edukasi pemasaran', 0, null],
];

export function demoTasks(now: number, firstSequence = 1): Task[] {
  return scenarios.map(([instruction, steps, decision], index) => {
    const sequence = firstSequence + index;
    const at = now - (scenarios.length - index) * 3_600_000;
    const created = createTask(instruction, sequence, at);
    if (!created.ok) throw new Error(created.error);
    let task = created.task;
    const run = (count: number) => {
      for (let i = 0; i < count; i++) {
        const next = advance(task, sequence, at + (i + 1) * 60_000);
        if (!next.ok) throw new Error(next.error);
        task = next.task;
      }
    };
    run(steps);
    if (decision) {
      const result = decide(
        task,
        decision,
        task.version,
        'Ubah nada visual',
        at + 600_000,
      );
      if (!result.ok) throw new Error(result.error);
      task = result.task;
      // A revised task goes back through the owner and is approved on the second try.
      if (decision === 'revise') {
        run(3);
        const again = decide(task, 'approve', task.version, '', at + 900_000);
        if (!again.ok) throw new Error(again.error);
        task = again.task;
      }
    }
    return task;
  });
}
