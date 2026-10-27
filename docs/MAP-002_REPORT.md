# Map delapan area — hasil implementasi

Tanggal: 27 Oktober 2026. Scope disetujui pengguna: map lengkap, akses antar-ruangan, penghalang, dan satu Akira sebagai karakter uji.

## Hasil

Map isometrik 30 × 30 petak mencakup Lobby, Main Workspace, Approval Room, Command Room, Mushola, Break Lounge, Garden, dan Pool Area. Renderer memakai geometri prosedural dengan lantai putih/marmer sederhana, pembatas kaca beraksen emas, meja, monitor, sofa, kursi, sajadah, tanaman dan kolam. Ini interpretasi interaktif dari referensi, belum kualitas render fotorealistik pada gambar sumber.

Definisi area, pintu dan furnitur berada di `apps/web/src/office/layout.ts`. Collision memakai footprint yang sama, termasuk seluruh permukaan air dan kursi. Tombol tujuan mengarahkan Akira melalui BFS empat arah; tombol fokus area memperbesar kamera. Zoom, pan, reset, jeda/lanjut, jalur visual dan status nama area tersedia.

Saat pekerjaan dilanjutkan, sheet Akira sudah berganti menjadi `Img/Karakter/Akira-General manager-Lead cordinator.png` dengan susunan enam frame per baris. Import dan frame runtime disesuaikan dengan file saat ini. Idle memakai frame depan, berjalan memakai baris samping kiri/kanan. Sheet tetap pratinjau berlatar putih dengan blending, belum atlas transparan produksi.

## Verifikasi

- PASS: `corepack pnpm test`, 6 file / 13 tes. Mencakup tujuan setiap area dari lobby, langkah bersebelahan, seluruh sel footprint furnitur/air/pembatas, tujuan invalid, dan proyeksi isometrik.
- Satu run awal terkena timeout 5 detik pada health backend. Run ulang seluruh suite lulus tanpa mengubah timeout atau kode backend.
- PASS: `corepack pnpm build`, frontend/backend dan pemeriksaan TypeScript. Build awal mendeteksi import Akira lama; sudah diperbaiki dan build ulang lulus.
- PASS: `corepack pnpm lint` setelah perubahan terakhir.
- Build memberi peringatan ukuran chunk Phaser: sekitar 1.38 MB, gzip 360 KB; scene tetap lazy-loaded. Optimasi atlas/bundle belum dilakukan.
- Browser: seluruh map tampil; perjalanan lobby → Garden diuji sebelum pergantian sheet; lobby → Pool Area diuji dengan sheet baru dan status kedatangan terverifikasi. Klik air kolam setelah zoom ditolak.
- Browser: fokus Garden/Pool, reset seluruh kantor, viewport desktop dan 390 × 844 diperiksa. Pada viewport kecil, clientWidth = scrollWidth = 375 px, canvas berjumlah satu. Ukuran browser dipulihkan setelah tes.
- Review sumber independen tidak menemukan blocker; saran menguji seluruh footprint properti diterapkan.

Tidak ada tes browser otomatis, audit screen reader menyeluruh, pengukuran FPS, atau uji seluruh jalur secara visual. Tes konektivitas otomatis mencakup delapan tujuan, bukan seluruh kemungkinan pasangan titik. Lifecycle tetap memakai cleanup pratinjau sebelumnya; navigasi remount sudah diperiksa pada OFFICE-001.

## Aset dan batas tahap

Tidak ada file Img yang ditulis oleh implementasi ini. Baseline historis dipertahankan: enam file lama yang masih sama cocok hash-nya; Akira sudah berganti nama/isi dan Zegion juga berbeda dari baseline saat sesi dilanjutkan. Perubahan sumber tersebut tidak dibatalkan. Hash Akira saat adaptasi: `6D8D91CD37063EECC133AAA103819AA4533129D946501D19E6F84696B8726840`.

Enam representasi tambahan, atlas transparan, animasi bekerja/istirahat/interaksi, workflow task, approval aktif, monitoring AI, jadwal salat dan Hermes belum dibuat. OFFICE-003 tetap parsial karena baru bagian map yang selesai. Tidak memasang dependency, commit, push, atau deploy.

Server lokal dijalankan kembali untuk pratinjau di `http://127.0.0.1:5173/#/office`. Jika berhenti, jalankan `corepack pnpm dev` dari root proyek.

![Map delapan area](screenshots/map-002-desktop.png)

## Pembaruan 27 Oktober 2026 — denah asli sebagai peta

Peta prosedural isometrik diganti dengan gambar `Img/Map/Denah Kantor Mewah 204. Project Group.png` (1536 × 1024) yang ditampilkan apa adanya. Di atasnya ada grid jalan 16 px sejajar layar (96 × 64 petak) tanpa render. Lantai, penghalang (meja, sofa, kolam, pohon, dinding) dan pintu ditulis sebagai persegi dalam piksel gambar di `apps/web/src/office/layout.ts`, lalu dijadikan petak jalan saat modul dimuat. BFS empat arah tetap dipakai. `render-map.ts` dihapus.

- Akira muncul di pintu masuk Lobby dan berjalan ke delapan area; diuji di browser ke Mushola, Pool Area, Break Lounge dan Command Room.
- Tes otomatis: setiap area terjangkau dari pintu masuk dan dari area lain; furnitur, air dan dinding tidak bisa dilewati.
- Batas: Akira selalu digambar di atas peta, jadi tidak tertutup furnitur gambar. Persegi penghalang adalah perkiraan; kalibrasi detail masih bisa disempurnakan. Interior Break Lounge di sisi kiri belum dicek jalur demi jalur.
