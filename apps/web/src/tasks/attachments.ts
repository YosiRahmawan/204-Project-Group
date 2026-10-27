// Files attached to an instruction. They stay in this browser tab (no backend yet).
export type Attachment = {
  name: string;
  size: number;
  type: string;
  // Object URL for images so they can be previewed; null for everything else.
  previewUrl: string | null;
};

export const maxFiles = 5;
export const maxBytes = 10 * 1024 * 1024;

const prefixes = ['image/', 'video/', 'audio/'];
const exact = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
export const accept = [...prefixes.map((p) => `${p}*`), ...exact].join(',');

type Candidate = { name: string; size: number; type: string };

// Decides which of the chosen files fit; never accepts programs or archives.
export function checkFiles(already: number, files: Candidate[]) {
  const accepted: number[] = [];
  const errors: string[] = [];
  files.forEach((file, index) => {
    if (already + accepted.length >= maxFiles)
      errors.push(`${file.name}: maksimal ${maxFiles} lampiran per instruksi.`);
    else if (
      !prefixes.some((p) => file.type.startsWith(p)) &&
      !exact.has(file.type)
    )
      errors.push(`${file.name}: jenis file ini tidak diizinkan.`);
    else if (file.size > maxBytes)
      errors.push(`${file.name}: lebih dari ${formatSize(maxBytes)}.`);
    else if (file.size === 0) errors.push(`${file.name}: file kosong.`);
    else accepted.push(index);
  });
  return { accepted, errors };
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
