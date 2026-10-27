export const team = [
  {
    name: 'Akira',
    initials: 'AK',
    role: 'General Manager',
    specialty: 'Lead Coordinator',
    description:
      'Koordinator utama yang nantinya menganalisis instruksi CEO dan membagi pekerjaan melalui backend.',
    tone: 'plum',
  },
  {
    name: 'Aeri',
    initials: 'AE',
    role: 'Brand Ambassador',
    specialty: 'Social Media',
    description:
      'Menyiapkan usulan komunikasi brand dan konten media sosial sesuai arahan CEO.',
    tone: 'rose',
  },
  {
    name: 'Amy',
    initials: 'AM',
    role: 'Digital Marketing',
    specialty: 'Marketing Specialist',
    description:
      'Mendukung analisis, perencanaan, dan evaluasi pemasaran digital.',
    tone: 'stone',
  },
  {
    name: 'Kuro',
    initials: 'KU',
    role: 'Art Director',
    specialty: 'Lead Designer',
    description: 'Menjaga arahan visual dan kualitas keluaran desain tim.',
    tone: 'blue',
  },
  {
    name: 'Mail',
    initials: 'MA',
    role: 'Finance Manager',
    specialty: 'Finance & Budget',
    description:
      'Mendukung analisis biaya, perencanaan anggaran, dan laporan keuangan.',
    tone: 'wine',
  },
  {
    name: 'Zegion',
    initials: 'ZE',
    role: 'Technology',
    specialty: 'Security & Reliability',
    description: 'Mendukung analisis teknis, keamanan, dan keandalan sistem.',
    tone: 'olive',
  },
] as const;
export type Member = (typeof team)[number];
