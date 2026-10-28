import type { PageId } from './navigation';

// 24 × 24 line icons, drawn here so the sidebar needs no icon dependency.
const paths: Record<PageId | 'collapse' | 'expand', string> = {
  overview: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  office: 'M4 21V9l8-5 8 5v12M9 21v-6h6v6M8 11h2M14 11h2',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  approvals: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
  team: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 100-6M18 15c2 .5 3 2.5 3 5',
  affiliate: 'M4 6h16v12H4zM10 9.5v5l4.5-2.5zM4 21h16',
  monitoring: 'M3 12h4l3-7 4 14 3-7h4',
  activity: 'M12 7v5l3 2M21 12a9 9 0 11-3-6.7M21 4v4h-4',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  collapse: 'M14 6l-6 6 6 6',
  expand: 'M10 6l6 6-6 6',
};

export function Icon({ id }: { id: keyof typeof paths }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[id]} />
    </svg>
  );
}
