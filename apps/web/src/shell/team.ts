export const team = [
  {
    name: 'Akira',
    role: 'General Manager',
    specialty: 'Lead Coordinator',
    description:
      'Koordinator utama yang nantinya menganalisis instruksi CEO dan membagi pekerjaan melalui backend.',
    tone: 'plum',
  },
  {
    name: 'Aeri',
    role: 'Brand Ambassador',
    specialty: 'Social Media',
    description:
      'Menyiapkan usulan komunikasi brand dan konten media sosial sesuai arahan CEO.',
    tone: 'rose',
  },
  {
    name: 'Amy',
    role: 'Digital Marketing',
    specialty: 'Marketing Specialist',
    description:
      'Mendukung analisis, perencanaan, dan evaluasi pemasaran digital.',
    tone: 'stone',
  },
  {
    name: 'Kuro',
    role: 'Art Director',
    specialty: 'Lead Designer',
    description: 'Menjaga arahan visual dan kualitas keluaran desain tim.',
    tone: 'blue',
  },
  {
    name: 'Mail',
    role: 'Finance Manager',
    specialty: 'Finance & Budget',
    description:
      'Mendukung analisis biaya, perencanaan anggaran, dan laporan keuangan.',
    tone: 'wine',
  },
  {
    name: 'Zegion',
    role: 'Technology',
    specialty: 'Security & Reliability',
    description: 'Mendukung analisis teknis, keamanan, dan keandalan sistem.',
    tone: 'olive',
  },
] as const;
export type Member = (typeof team)[number];
