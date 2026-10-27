# Windows development setup

Audit: 26 Oktober 2026, Asia/Jakarta. Root tetap `D:\Project-Office starup`. Panduan ini untuk fondasi lokal; belum layak diekspos sebagai layanan produksi.

## Environment terdeteksi sebelum instalasi

| Software          | Versi/status                                                         | Tindakan                                                          |
| ----------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Windows           | Windows 11 Home Single Language, 10.0.26200, x64                     | Sudah tersedia                                                    |
| Node.js           | 22.20.0                                                              | Kompatibel; tidak diubah                                          |
| npm               | 11.7.0                                                               | Hanya digunakan untuk query metadata registry                     |
| Corepack          | 0.34.0                                                               | Menjalankan pnpm tanpa shim global                                |
| pnpm global       | Tidak ditemukan                                                      | Gunakan `corepack pnpm`                                           |
| pnpm via Corepack | 10.34.9 berhasil dijalankan                                          | Dipin di packageManager                                           |
| Git               | 2.55.0.windows.1                                                     | Repository dan origin sudah ada                                   |
| TypeScript global | Tidak ditemukan                                                      | Dipasang lokal sebagai devDependency                              |
| Python            | 3.14.0                                                               | Sudah tersedia; bukan runtime aplikasi                            |
| VS Code           | 1.143.1 x64                                                          | Opsional, sudah tersedia                                          |
| Rust/Cargo        | Tidak ditemukan di PATH                                              | Tidak dipasang; audit ulang saat Tauri                            |
| C++ Build Tools   | VS 2019 16.11.52 dan VS 2022 17.12.2, komponen VC x64/x86 terdeteksi | Tidak diubah; SDK dan build native belum diuji                    |
| WebView2 Runtime  | 155.0.4283.62                                                        | Terdeteksi registry, belum diuji dengan Tauri                     |
| Disk awal         | C sekitar 9.63 GiB; D sekitar 35.12 GiB tersedia                     | Nilai snapshot; gunakan D untuk proyek                            |
| Tiled             | Belum diverifikasi                                                   | Tidak diperlukan untuk fondasi; pasang setelah approval fase peta |

`origin`: https://github.com/YosiRahmawan/204-Project-Group.git. Git ownership berbeda antara akun sandbox dan Acer. Untuk operasi baca sesi ini digunakan `git -c "safe.directory=D:/Project-Office starup" status`; tidak menambahkan pengecualian global. Tidak ada commit/push/deploy.

## Pilihan versi dan kompatibilitas

Versi exact berasal dari `npm view` registry npm, bukan tebakan. Lihat package.json masing-masing dan pnpm-lock.yaml untuk sumber kebenaran. Vite 8.3.5 membutuhkan Node ^20.19 atau >=22.12; Vitest 5.0.5 membutuhkan ^22.12, ^24 atau >=26. Node 22.20 memenuhi keduanya. Fastify 5 memakai Node >=20. Tailwind 4 dipasang dengan plugin Vite, bukan konfigurasi Tailwind 3.

TypeScript latest 7.0.2 tidak dipilih: typescript-eslint 8.72.0 mendukung TypeScript >=4.8.4 <6.1.0. Dipilih TypeScript 6.0.3. Corepack 0.34.0 gagal menjalankan pnpm 12.15.0 dengan MODULE_NOT_FOUND (bin/pnpm.cjs); gunakan pnpm 10.34.9 yang telah diuji. Tidak ada upgrade Corepack atau instalasi global.

Sumber: [Vite](https://vite.dev/guide/), [Tailwind Vite](https://tailwindcss.com/docs/installation/using-vite), [Fastify LTS](https://fastify.dev/docs/latest/Reference/LTS/), [pnpm](https://pnpm.io/installation), [TypeScript ESLint](https://typescript-eslint.io/users/dependency-versions/), metadata https://registry.npmjs.org/.

## Menjalankan dari PowerShell

```powershell
Set-Location 'D:\Project-Office starup'
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Frontend: http://127.0.0.1:5173 . Backend: http://127.0.0.1:3001/health . Keduanya bind loopback. Vite strictPort mencegah pindah port diam-diam. Root dev menjalankan kedua workspace secara paralel; Ctrl+C menghentikannya. Tanpa .env, default aman digunakan.

Opsional: salin `.env.example` menjadi `.env` di root, lalu edit PORT/WEB_ORIGIN. Server memuat root .env melalui Node `--env-file-if-exists`; variabel environment proses mengambil prioritas. `WEB_ORIGIN` harus origin HTTP(S) tepat tanpa path; port frontend tetap 5173 kecuali script/config diubah. HOST dibatasi 127.0.0.1 atau ::1; akses publik memerlukan perubahan terencana setelah auth dan pengamanan fase backend.

Jalankan terpisah:

```powershell
corepack pnpm --filter @204/web dev
corepack pnpm --filter @204/server dev
corepack pnpm build
corepack pnpm --filter @204/server start
Invoke-RestMethod http://127.0.0.1:3001/health
```

## Dependency fondasi

Web: React, React DOM, Phaser (terpasang tetapi belum diimpor/dijalankan). Build: Vite, plugin React, Tailwind dan plugin Vite. Server: Fastify, @fastify/cors, Zod; tsx untuk dev. Root: TypeScript, Vitest, ESLint + typescript-eslint + hooks, Prettier, globals dan type declarations.

Belum dipasang: SQLite driver, Drizzle, WebSocket plugin, Playwright, Tauri, SDK Hermes, library jadwal salat. Placeholder packages sengaja hanya dokumentasi agar tidak menciptakan API domain sebelum desain disetujui.

## Quality gate

```powershell
corepack pnpm typecheck
corepack pnpm build
corepack pnpm lint
corepack pnpm test
corepack pnpm format:check
```

`format` menulis format source/dokumen; `format:check` hanya memeriksa. `Img/`, aset dan lockfile dikecualikan Prettier. Unit test API memakai Fastify inject; smoke HTTP nyata tetap diuji terpisah. Hasil aktual dicatat di SETUP_REPORT.md.

## Instalasi Windows bila software belum ada

Node/Git/pnpm yang memerlukan perubahan sistem wajib approval CEO. Unduh Node LTS kompatibel dari https://nodejs.org/en/download dan Git dari https://git-scm.com/downloads/win; verifikasi installer resmi. Setelah Node tersedia, Corepack dapat menjalankan versi pnpm yang dipin. Jangan menggunakan script remote pipe-to-shell, --force, mematikan proteksi Windows, atau mengubah PATH secara agresif. Tidak diperlukan Docker atau instalasi Python/Rust untuk fase ini. Tiled dari https://www.mapeditor.org/ hanya pada fase peta. Prasyarat desktop saat disetujui: https://v2.tauri.app/start/prerequisites/.

## Troubleshooting

- `pnpm` tidak dikenali: gunakan `corepack pnpm`, jangan instal global otomatis.
- Corepack memilih pnpm 12: pastikan berada di root dengan packageManager pnpm@10.34.9; gunakan `corepack pnpm@10.34.9` bila diperlukan.
- Akses registry gagal: periksa jaringan/proxy; jangan menonaktifkan verifikasi TLS.
- Port dipakai: tutup proses milik sendiri atau konfigurasi port dan WEB_ORIGIN secara konsisten; jangan kill proses yang tidak dikenal.
- Browser localhost berbeda origin: gunakan URL 127.0.0.1 yang didokumentasikan.
- Error config: cek PORT integer 1–65535, origin HTTP(S), dan LOG_LEVEL yang didukung.
- Git dubious ownership: periksa pemilik folder; gunakan pengecualian satu perintah untuk path ini, bukan safe.directory=*.
- Install script diblok pnpm: hanya esbuild diizinkan; evaluasi kebutuhan baru sebelum menambah allowlist.
- CORS bukan autentikasi: fondasi hanya health publik di loopback; belum ada sesi CEO.
