# 204. PROJECT GROUP

App shell kantor virtual untuk satu CEO manusia (Leo) dan enam AI Agent yang direncanakan. Navigasi delapan layar, profil tim dan status health backend tersedia. Denah tampil sebagai referensi statis. Kantor interaktif, animasi, task, approval, database, realtime dan Hermes **belum aktif**.

## Quick start Windows

Prasyarat Node 22.20.x/24.x dan Corepack. Tidak perlu pnpm global.

```powershell
Set-Location 'D:\Project-Office starup'
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Web http://127.0.0.1:5173 ; health http://127.0.0.1:3001/health . Ctrl+C untuk berhenti. `.env` opsional mengikuti `.env.example`, hanya dimuat server dari root; jangan memasukkan secret ke VITE_*.

UI memeriksa `/api/health` setiap 30 detik melalui proxy development Vite ke port 3001 (timeout 5 detik, tombol periksa ulang tersedia). Jika PORT backend diubah, sesuaikan target proxy di apps/web/vite.config.ts. Build statis membutuhkan reverse proxy `/api` ketika nanti dipublikasikan; belum dikonfigurasi untuk hosting produksi. Navigasi memakai hash, misalnya `/#/team`, sehingga reload/back tidak memerlukan fallback routing server.

Hasil fase terbaru: [laporan UI-001](docs/UI-001_REPORT.md), [screenshot desktop](docs/screenshots/ui-001-desktop.png). Laporan fondasi 26 Oktober tetap disimpan sebagai catatan historis.

## Pemeriksaan

`corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm lint`, `corepack pnpm test`, `corepack pnpm format:check`. `corepack pnpm format` memformat source/dokumen. Backend hasil build: `corepack pnpm --filter @204/server start`.

## Struktur

- apps/web: shell React/Vite + Tailwind, navigasi, profil tim, status backend; peta isometrik interaktif (gambar dasar + lapisan SVG).
- apps/server: Fastify health, validasi config Zod, CORS terbatas.
- packages/contracts, simulation, agent-adapters: batas modul masa depan, placeholder README.
- Img: referensi asli yang wajib dipertahankan.
- assets/source dan assets/runtime: tempat kerja aset masa depan, belum berisi sprite produksi.
- docs: [PRD](docs/PRD.md), [Desain](docs/DESIGN.md), [Arsitektur](docs/ARCHITECTURE.md), [Setup](docs/SETUP.md), [Task](docs/TASKS.md), [Laporan verifikasi](docs/SETUP_REPORT.md).
- tests: lokasi pengujian lintas aplikasi di tahap berikutnya; test fondasi colocated di src.

## Standar kerja

ES modules, TypeScript strict, direktori lowercase-kebab-case, komponen React PascalCase.tsx, modul lowercase-kebab-case.ts, tes *.test.ts(x), env UPPER_SNAKE_CASE. Pertahankan ejaan nama file asli Img. Satu lockfile pnpm; tidak menggunakan npm install di workspace. Tidak menyimpan .env/kredensial, tidak menambahkan arbitrary shell API. Endpoint health bukan autentikasi. Production memerlukan fase security sebelum dipublikasikan.

Berhenti setelah UI-001; rendering kantor interaktif berikutnya membutuhkan persetujuan CEO.
