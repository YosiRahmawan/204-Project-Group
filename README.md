# 204. PROJECT GROUP

Kantor virtual untuk satu CEO manusia (Leo) dan enam AI Agent yang direncanakan. Sudah ada: peta isometrik interaktif dengan tujuh karakter, Task board kanban, Approval inbox, Riwayat & log, dashboard, lampiran file, dan login untuk Leo. Task, riwayat, dan lampiran tersimpan di server (SQLite). Langkah-langkah task masih **simulasi**: belum ada AI/Hermes yang mengerjakannya.

## Quick start Windows

Prasyarat Node 22.20.x/24.x dan Corepack. Tidak perlu pnpm global.

```powershell
Set-Location 'D:\Project-Office starup'
Copy-Item .env.example .env   # lalu isi OWNER_PASSWORD (minimal 12 karakter)
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Web http://127.0.0.1:5173 ; health http://127.0.0.1:3001/health . Masuk dengan kata sandi dari `OWNER_PASSWORD` di `.env`. Server tidak mau berjalan tanpa kata sandi itu. `.env` hanya dimuat server dari root dan tidak boleh di-commit; jangan memasukkan secret ke VITE\_\*.

Data ada di `apps/server/data/` (database `204.db` dan folder `uploads/`), diabaikan git. Hapus folder itu untuk mulai dari nol. Web memanggil server lewat proxy dev Vite `/api` ke port 3001; jika PORT diubah, sesuaikan `apps/web/vite.config.ts`. Hosting produksi belum dikonfigurasi (perlu reverse proxy `/api` dan HTTPS).

## Agent (Tim & Agent)

Halaman Tim & agent kini menyimpan konfigurasi enam agent bawaan dan agent baru di database (`+ Add Agent`, Edit, Aktifkan/Nonaktifkan): peran, atasan, provider/model, system prompt, izin dan alat, memori, batas sumber daya. Ini **hanya konfigurasi**: belum ada AI yang dijalankan, jadi status runtime selalu "Not Connected" ("AI execution is not configured yet."). Daftar provider/model ada di `apps/server/models.registry.json` (tambah model di sana). Kunci API hanya dari env server, tidak pernah dikirim ke browser. Persetujuan wajib (hapus data, deployment, rahasia, pesan keluar, transaksi keuangan, tulis memori bersama) selalu ditambahkan server dan tidak bisa dimatikan lewat prompt.

## AI Affiliate Studio (Fase 1)

Menu **AI Affiliate Studio**: campaign berisi produk, link afiliasi, hook/script, caption, hashtag, dan storyboard, disimpan di database. Semua teks bisa diedit dan disetujui Leo; mengedit setelah disetujui mengembalikan status ke Draft. Draf AI memakai agent Aeri (script, caption) dan Kuro (storyboard) lewat Anthropic dan hanya berjalan bila agent itu sudah diatur di Tim & agent (provider, model, anggaran token lebih dari 0) dan `ANTHROPIC_API_KEY` ada di server; selain itu server menolak dengan alasan yang jelas. Link tidak pernah dibuka atau di-scrape, dan tidak ada posting otomatis (unduh caption lalu posting manual). Editor video, musik, voice-over, tren, dan analytics belum ada.

## Memori Obsidian

Server bisa memakai vault Obsidian yang sudah ada sebagai memori (isi `OBSIDIAN_VAULT_PATH` di `.env`; vault harus sudah punya folder `.obsidian`). Struktur: `Agents/<agent>/` (memori pribadi), `Shared/`, `Strategy/`, `Campaigns/`, `Decisions/`, `Logs/`. Agent hanya menulis langsung ke folder pribadinya; perubahan ke area bersama berupa **usulan** yang harus Anda setujui (`/memory/proposals`). Penulisan atomik, ada backup di `.204-backups/`, konflik ditolak (tidak menimpa), path dibatasi di dalam vault, dan catatan yang berisi kunci/kata sandi ditolak. Pelajaran agent (`/memory/lessons`) tersimpan sebagai catatan "belum dievaluasi". Memori **tidak** otomatis dimasukkan ke prompt agent, dan Hermes belum diaktifkan.

## Akira lewat Hermes (Fase 1)

Backend memanggil Hermes lewat API server resminya (OpenAI-compatible, hanya `127.0.0.1`), tidak pernah dari browser. Isi `HERMES_API_URL` dan `HERMES_API_KEY` di `.env`, jalankan `hermes -p akira gateway run` (profile `akira`: toolset dibatasi tanpa terminal/file, memori Hermes mati, tanpa Telegram). Di Tim & agent, atur Akira ke provider **Hermes** model **akira** dan beri anggaran token. Halaman **Monitoring AI** menampilkan koneksi Hermes (dicek tiap 30 detik), runtime Akira, dan riwayat eksekusi (token; biaya "tidak tersedia" karena Hermes tidak melaporkan harga). Server menolak Akira bila Hermes punya tool yang bisa bertindak. Fase 1 hanya menjawab; perencanaan dan delegasi menyusul.

## Affiliate Studio: Video Studio gratis (FFmpeg lokal)

Rencana Free-First lengkap (provider gratis, berkuota, berbayar) ada di [docs/AFFILIATE-FREE-FIRST.md](docs/AFFILIATE-FREE-FIRST.md). Tab **Video Studio** memakai FFmpeg di laptop: unggah foto produk/presenter/latar dan musik berlisensi, rapikan foto ke 9:16 (salinan baru), susun scene dengan subtitle, zoom, dan fade, lalu ekspor MP4 1080x1920. Semua media disimpan di `MEDIA_DIR` (drive E:), biaya Rp0, tanpa API. Butuh FFmpeg terpasang dan `MEDIA_DIR` di `.env`.

## AI Studio (menu baru, menggantikan nama AI Affiliate Studio)

Satu campaign = satu proyek video. Modul: **AI Presenter Studio** (profil presenter dengan foto referensi dan pernyataan izin wajah, dipakai ulang antar campaign), **Product Studio** (data produk, link afiliasi, foto/video produk, latar polos buatan FFmpeg atau unggahan), **Storyboard & Template** (6 template, durasi 10-60 dtk, gaya video, scene yang bisa diedit, kerangka dari template **bukan AI**, saran hashtag dari kata produk), **Suara AI** (pilihan 30 suara Gemini dan gaya bicara, edit narasi per scene; pratinjau dan pembuatan suara belum aktif), **Edit & Ekspor Video** (scene, trim klip, latar per scene, subtitle, musik, transisi, MP4 9:16 lewat FFmpeg lokal), dan **Content Library**. Draf teks AI (Anthropic) tetap ada tetapi berbayar dan butuh persetujuan setiap kali. Belum ada: presenter berbicara, wajah konsisten dari AI, video AI, gambar AI, suara AI, dan auto post.

## Pemeriksaan

`corepack pnpm lint`, `typecheck`, `test`, `build`, `format:check`. Semuanya juga dijalankan GitHub Actions (`.github/workflows/ci.yml`) pada setiap push ke main dan pull request.

## Struktur

- apps/web: React/Vite + Tailwind; peta interaktif, Task board, Approval inbox, Riwayat, dashboard, login.
- apps/server: Fastify; login Leo, API task, unggah file aman, SQLite bawaan Node (`node:sqlite`).
- packages/contracts: aturan workflow task dan tipe bersama web dan server. Server yang memutuskan; web hanya menampilkan.
- packages/simulation, agent-adapters: batas modul masa depan, placeholder README.
- Img: referensi asli yang wajib dipertahankan.
- assets/runtime: atlas karakter, wajah, dan peta isometrik; `scripts/build-sprites.mjs` membuat atlas dari `Img/Karakter`.
- docs: [PRD](docs/PRD.md), [Desain](docs/DESIGN.md), [Arsitektur](docs/ARCHITECTURE.md), [Setup](docs/SETUP.md), [Task](docs/TASKS.md), [Laporan verifikasi](docs/SETUP_REPORT.md).

## Keamanan singkat

Satu pemilik, satu kata sandi. Sesi disimpan di database (hanya hash tokennya), jadi restart server tidak mengeluarkan Leo. Cookie `HttpOnly` dan `SameSite=Strict`; perubahan data wajib membawa header `x-requested-with`; lima kata sandi salah membuka kunci satu menit per alamat. Tiap jawaban membawa header pengaman. File yang diunggah dicek dari isinya, disimpan di luar folder web, dan hanya foto yang ditampilkan langsung. Setiap login, langkah task, dan unggahan dicatat permanen di tabel audit (lihat Riwayat & log, tab "Catatan audit server"). Klik ganda dan percobaan ulang tidak menggandakan task atau langkah. Perubahan muncul langsung di semua tab lewat aliran peristiwa (SSE). Untuk HTTPS, lihat [docs/DEPLOY.md](docs/DEPLOY.md). Belum ada pembatasan biaya AI atau pengguna lain.

## Standar kerja

ES modules, TypeScript strict, direktori lowercase-kebab-case, komponen React PascalCase.tsx, modul lowercase-kebab-case.ts, tes `*.test.ts(x)`, env UPPER_SNAKE_CASE. Pertahankan ejaan nama file asli Img. Satu lockfile pnpm; tidak menggunakan npm install di workspace. Tidak menyimpan `.env`/kredensial, tidak menambahkan arbitrary shell API.
