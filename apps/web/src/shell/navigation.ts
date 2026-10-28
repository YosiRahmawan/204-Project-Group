export const pages = [
  {
    id: 'overview',
    label: 'Ringkasan',
    description: 'Kantor Anda, dalam satu pandangan.',
  },
  {
    id: 'office',
    label: 'Kantor virtual',
    description: 'Satu kantor. Ruang untuk ide besar.',
  },
  {
    id: 'tasks',
    label: 'Task board',
    description: 'Dari sebuah ide menjadi pekerjaan yang terarah.',
  },
  {
    id: 'approvals',
    label: 'Approval inbox',
    description: 'Keputusan penting tetap di tangan Anda.',
  },
  {
    id: 'team',
    label: 'Tim & agent',
    description: 'Enam keahlian. Satu tujuan bersama.',
  },
  {
    id: 'affiliate',
    label: 'AI Affiliate Studio',
    description: 'Dari produk menjadi konten yang siap Anda setujui.',
  },
  {
    id: 'monitoring',
    label: 'Monitoring AI',
    description: 'Visibilitas atas eksekusi dan biaya AI.',
  },
  {
    id: 'activity',
    label: 'Riwayat & log',
    description: 'Setiap langkah memiliki jejak.',
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    description: 'Fondasi untuk cara kerja Anda.',
  },
] as const;

export type PageId = (typeof pages)[number]['id'];
export function resolvePage(hash: string) {
  return pages.find((page) => `#/${page.id}` === hash) ?? pages[0];
}
