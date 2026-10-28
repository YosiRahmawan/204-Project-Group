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
