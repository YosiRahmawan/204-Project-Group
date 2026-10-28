// AI Studio: the choices Leo makes for a campaign (template, style, duration, voice) and a
// plain template scaffold. The scaffold fills text slots from the product fields; it is not
// AI output and is labelled that way wherever it is shown.
import type { CampaignInput } from './affiliate.js';

export const DURATIONS = [10, 15, 20, 30, 45, 60] as const;
export type Duration = (typeof DURATIONS)[number];

// Only vertical is rendered for now; the others are listed so the plan is visible.
export const RATIOS = [
  { id: '9:16', label: '9:16 (TikTok, Reels, Shorts)', ready: true },
  { id: '1:1', label: '1:1', ready: false },
  { id: '16:9', label: '16:9', ready: false },
] as const;

export const VIDEO_STYLES = [
  { id: 'promo', label: 'Promo' },
  { id: 'storytelling', label: 'Storytelling' },
  { id: 'review', label: 'Review' },
  { id: 'demo', label: 'Demo' },
  { id: 'problem-solution', label: 'Problem-solution' },
  { id: 'ugc', label: 'UGC style' },
  { id: 'soft-sell', label: 'Soft sell' },
] as const;

export const PRESENTER_STYLES = [
  { id: 'casual', label: 'Casual' },
  { id: 'profesional', label: 'Profesional' },
  { id: 'soft-sell', label: 'Soft sell' },
  { id: 'energetic', label: 'Energetic' },
] as const;

export const SPEAKING_STYLES = [
  { id: 'santai', label: 'Santai' },
  { id: 'energik', label: 'Energik' },
  { id: 'tenang', label: 'Tenang' },
  { id: 'profesional', label: 'Profesional' },
] as const;

// Plain gradients made locally with FFmpeg. Realistic rooms need an uploaded photo or, later,
// an image provider; these are honest neutral backdrops.
export const BACKGROUND_PRESETS = [
  { id: 'netral-putih', label: 'Netral putih', c0: 'F7F5F0', c1: 'E4E1D9' },
  { id: 'netral-abu', label: 'Netral abu', c0: 'D9D9D9', c1: 'A8A8A8' },
  { id: 'studio-hangat', label: 'Studio hangat', c0: 'F3E3C8', c1: 'D2B48C' },
  {
    id: 'studio-biru',
    label: 'Studio biru lembut',
    c0: 'DCE8F2',
    c1: '9DB7CF',
  },
  { id: 'gelap-elegan', label: 'Gelap elegan', c0: '2B2B2B', c1: '0E0E0E' },
] as const;

// The 30 prebuilt Gemini TTS voices as listed in its documentation. The documentation gives a
// style word but no gender, so gender stays unknown until Leo has listened and mapped them.
export const VOICES = [
  ['Zephyr', 'Bright'],
  ['Puck', 'Upbeat'],
  ['Charon', 'Informative'],
  ['Kore', 'Firm'],
  ['Fenrir', 'Excitable'],
  ['Leda', 'Youthful'],
  ['Orus', 'Firm'],
  ['Aoede', 'Breezy'],
  ['Callirrhoe', 'Easy-going'],
  ['Autonoe', 'Bright'],
  ['Enceladus', 'Breathy'],
  ['Iapetus', 'Clear'],
  ['Umbriel', 'Easy-going'],
  ['Algieba', 'Smooth'],
  ['Despina', 'Smooth'],
  ['Erinome', 'Clear'],
  ['Algenib', 'Gravelly'],
  ['Rasalgethi', 'Informative'],
  ['Laomedeia', 'Upbeat'],
  ['Achernar', 'Soft'],
  ['Alnilam', 'Firm'],
  ['Schedar', 'Even'],
  ['Gacrux', 'Mature'],
  ['Pulcherrima', 'Forward'],
  ['Achird', 'Friendly'],
  ['Zubenelgenubi', 'Casual'],
  ['Vindemiatrix', 'Gentle'],
  ['Sadachbia', 'Lively'],
  ['Sadaltager', 'Knowledgeable'],
  ['Sulafat', 'Warm'],
].map(([id, tone]) => ({
  id: id!,
  tone: tone!,
  gender: null as 'perempuan' | 'laki-laki' | null,
}));

export const TEMPLATES = [
  {
    id: 'affiliate-promo',
    label: 'Affiliate promo',
    hint: 'Hook, manfaat, bukti, harga, ajakan beli.',
  },
  {
    id: 'review-jujur',
    label: 'Review jujur',
    hint: 'Kesan pertama, kelebihan, catatan, kesimpulan.',
  },
  {
    id: 'problem-solution',
    label: 'Problem-solution',
    hint: 'Masalah yang dialami, lalu produk sebagai solusi.',
  },
  {
    id: 'before-after',
    label: 'Before-after',
    hint: 'Kondisi sebelum, memakai produk, kondisi sesudah.',
  },
  {
    id: 'demo',
    label: 'Demo penggunaan',
    hint: 'Langkah memakai produk dari awal sampai hasil.',
  },
  {
    id: 'ugc',
    label: 'UGC / TikTok style',
    hint: 'Santai seperti cerita teman, singkat dan dekat.',
  },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]['id'];

type Beat = {
  visual: string;
  voiceover: string;
  text: string;
  needs?: 'harga';
};
const beats: Record<TemplateId, Beat[]> = {
  'affiliate-promo': [
    {
      visual: 'Produk close-up, tampil jelas',
      voiceover: 'Stop scroll dulu! Ini {produk}.',
      text: '{produk}',
    },
    {
      visual: 'Produk di tangan atau di meja',
      voiceover: 'Cocok banget buat {target}.',
      text: 'Cocok untuk {target}',
    },
    {
      visual: 'Detail utama produk',
      voiceover: 'Keunggulannya: {manfaat}.',
      text: '{manfaat}',
    },
    {
      visual: 'Produk dari sudut berbeda',
      voiceover: 'Bentuk dan kualitasnya bisa kamu lihat sendiri di sini.',
      text: 'Lihat detailnya',
    },
    {
      visual: 'Produk dengan teks harga',
      voiceover: 'Harganya cuma {harga}.',
      text: '{harga}',
      needs: 'harga',
    },
    {
      visual: 'Produk dan penjual/presenter',
      voiceover: 'Banyak yang sudah pakai dan puas.',
      text: 'Sudah dipakai banyak orang',
    },
    {
      visual: 'Produk dengan tombol keranjang',
      voiceover: 'Cek keranjang kuning sekarang.',
      text: 'Cek keranjang kuning',
    },
    {
      visual: 'Produk, layar penutup',
      voiceover: 'Klik link di bio sebelum kehabisan.',
      text: 'Link di bio',
    },
  ],
  'review-jujur': [
    {
      visual: 'Presenter memegang produk',
      voiceover: 'Aku coba {produk}, ini review jujurnya.',
      text: 'Review jujur {produk}',
    },
    {
      visual: 'Produk baru dibuka',
      voiceover: 'Kesan pertama: tampilannya rapi.',
      text: 'Kesan pertama',
    },
    {
      visual: 'Produk dipakai',
      voiceover: 'Yang aku suka: {manfaat}.',
      text: 'Kelebihan: {manfaat}',
    },
    {
      visual: 'Detail produk',
      voiceover: 'Catatannya, pastikan sesuai kebutuhanmu sebagai {target}.',
      text: 'Catatan',
    },
    {
      visual: 'Produk dengan teks harga',
      voiceover: 'Harganya {harga}, menurutku sepadan.',
      text: '{harga}',
      needs: 'harga',
    },
    {
      visual: 'Presenter menyimpulkan',
      voiceover: 'Kesimpulannya, aku rekomendasikan.',
      text: 'Kesimpulan',
    },
    {
      visual: 'Produk dan link',
      voiceover: 'Linknya ada di keranjang kuning.',
      text: 'Link di keranjang',
    },
  ],
  'problem-solution': [
    {
      visual: 'Orang tampak bingung atau kesulitan',
      voiceover: 'Pernah repot soal ini?',
      text: 'Pernah repot?',
    },
    {
      visual: 'Masalah sehari-hari',
      voiceover: 'Apalagi buat {target}, pasti sering kejadian.',
      text: 'Masalah sehari-hari',
    },
    {
      visual: 'Produk muncul',
      voiceover: 'Makanya ada {produk}.',
      text: '{produk}',
    },
    {
      visual: 'Produk dipakai',
      voiceover: 'Hasilnya: {manfaat}.',
      text: '{manfaat}',
    },
    {
      visual: 'Detail produk',
      voiceover: 'Bisa kamu lihat detailnya jelas di sini.',
      text: 'Lihat detail',
    },
    {
      visual: 'Produk dengan teks harga',
      voiceover: 'Harganya {harga}.',
      text: '{harga}',
      needs: 'harga',
    },
    {
      visual: 'Produk dan tombol keranjang',
      voiceover: 'Coba sekarang lewat link di bio.',
      text: 'Coba sekarang',
    },
  ],
  'before-after': [
    {
      visual: 'Kondisi sebelum',
      voiceover: 'Ini kondisinya sebelum pakai {produk}.',
      text: 'Sebelum',
    },
    {
      visual: 'Produk diperkenalkan',
      voiceover: 'Lalu aku coba {produk}.',
      text: '{produk}',
    },
    {
      visual: 'Produk dipakai',
      voiceover: 'Caranya mudah, cocok buat {target}.',
      text: 'Cara pakai',
    },
    {
      visual: 'Kondisi sesudah',
      voiceover: 'Hasilnya: {manfaat}.',
      text: 'Sesudah',
    },
    {
      visual: 'Perbandingan berdampingan',
      voiceover: 'Bedanya terlihat jelas.',
      text: 'Bedanya jelas',
    },
    {
      visual: 'Produk dengan teks harga',
      voiceover: 'Harganya {harga}.',
      text: '{harga}',
      needs: 'harga',
    },
    {
      visual: 'Produk dan link',
      voiceover: 'Mau coba juga? Klik link di bio.',
      text: 'Link di bio',
    },
  ],
  demo: [
    {
      visual: 'Produk di meja',
      voiceover: 'Aku tunjukkan cara pakai {produk}.',
      text: 'Cara pakai {produk}',
    },
    {
      visual: 'Langkah pertama',
      voiceover: 'Langkah pertama, siapkan produknya.',
      text: 'Langkah 1',
    },
    {
      visual: 'Langkah kedua',
      voiceover: 'Lalu pakai seperti ini.',
      text: 'Langkah 2',
    },
    {
      visual: 'Hasil pemakaian',
      voiceover: 'Hasilnya: {manfaat}.',
      text: '{manfaat}',
    },
    {
      visual: 'Detail produk',
      voiceover: 'Cocok untuk {target}.',
      text: 'Cocok untuk {target}',
    },
    {
      visual: 'Produk dengan teks harga',
      voiceover: 'Harganya {harga}.',
      text: '{harga}',
      needs: 'harga',
    },
    {
      visual: 'Produk dan link',
      voiceover: 'Linknya ada di keranjang kuning.',
      text: 'Cek keranjang kuning',
    },
  ],
  ugc: [
    {
      visual: 'Presenter bicara ke kamera, santai',
      voiceover: 'Guys, aku nemu {produk}.',
      text: 'Nemu {produk}',
    },
    {
      visual: 'Produk ditunjukkan ke kamera',
      voiceover: 'Ini kepake banget buat {target}.',
      text: 'Kepake banget',
    },
    {
      visual: 'Produk dipakai',
      voiceover: 'Yang bikin aku suka: {manfaat}.',
      text: '{manfaat}',
    },
    {
      visual: 'Detail produk',
      voiceover: 'Lihat deh detailnya.',
      text: 'Lihat detailnya',
    },
    {
      visual: 'Produk dengan teks harga',
      voiceover: 'Harganya {harga}, lumayan kan.',
      text: '{harga}',
      needs: 'harga',
    },
    {
      visual: 'Presenter menutup',
      voiceover: 'Kalau mau, linknya aku taruh di bio ya.',
      text: 'Link di bio',
    },
  ],
};

export const sceneCountFor = (duration: number) =>
  ({ 10: 3, 15: 4, 20: 4, 30: 5, 45: 7, 60: 8 })[duration as Duration] ?? 5;

type Product = CampaignInput['product'];
const fill = (text: string, p: Product) =>
  text
    .replaceAll('{produk}', p.name.trim() || 'produk ini')
    .replaceAll(
      '{manfaat}',
      p.benefits.split(/\n|;/)[0]?.trim() || 'praktis dipakai sehari-hari',
    )
    .replaceAll('{target}', p.targetBuyer.trim() || 'kamu')
    .replaceAll(
      '{harga}',
      p.priceIdr ? `Rp${p.priceIdr.toLocaleString('id-ID')}` : '',
    );

// A storyboard of the right length from a template: first and last beats always stay, the
// middle ones are spread evenly, and the seconds add up exactly to the chosen duration.
export function scaffold(
  template: TemplateId,
  product: Product,
  duration: number,
) {
  const usable = beats[template].filter(
    (b) => !b.needs || (b.needs === 'harga' && product.priceIdr),
  );
  const count = Math.min(sceneCountFor(duration), usable.length);
  const picked =
    count >= usable.length
      ? usable
      : Array.from(
          { length: count },
          (_, i) =>
            usable[Math.round((i * (usable.length - 1)) / (count - 1))]!,
        );
  const base = Math.floor(duration / picked.length);
  let left = duration - base * picked.length;
  return picked.map((beat) => {
    const seconds = base + (left-- > 0 ? 1 : 0);
    return {
      visual: fill(beat.visual, product),
      voiceover: fill(beat.voiceover, product),
      text: fill(beat.text, product),
      seconds,
      assetId: null,
      backgroundAssetId: null,
      trimStart: 0,
    };
  });
}

// Suggestions from the words of the product name and the template. Not trend data.
export function suggestHashtags(
  product: Product,
  template: TemplateId,
): string[] {
  const words = product.name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3)
    .slice(0, 3);
  const byTemplate: Record<TemplateId, string[]> = {
    'affiliate-promo': ['rekomendasi', 'racunbelanja'],
    'review-jujur': ['review', 'reviewjujur'],
    'problem-solution': ['solusi', 'tipspraktis'],
    'before-after': ['beforeafter', 'hasilnyata'],
    demo: ['carapakai', 'tutorial'],
    ugc: ['ugc', 'fyp'],
  };
  return [...new Set([...words, ...byTemplate[template], 'affiliate'])].slice(
    0,
    8,
  );
}
