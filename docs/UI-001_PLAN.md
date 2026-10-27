# UI-001 — App shell dan navigasi

Tanggal: 27 Oktober 2026. Dilanjutkan berdasarkan instruksi CEO “kerjakan yang sempat terhenti kemarin”. Lingkup hanya M1/UI-001; OFFICE-001 dan integrasi AI belum dimulai.

## Keputusan

Pertahankan React/Vite/Tailwind dan token DESIGN.md. Tidak menambah dependency. Gunakan navigasi hash native untuk delapan layar, sehingga deep link/reload/back bekerja tanpa konfigurasi server tambahan. Dashboard menampilkan denah asli sebagai gambar referensi berlabel, bukan dunia interaktif. Identitas enam agent berasal dari PRD, tanpa data pekerjaan/biaya palsu. Leo adalah CEO manusia. Detail tim memakai dialog native dengan Escape dan fokus kembali ke pemicu.

Status koneksi membaca health API yang sudah ada melalui proxy dev Vite /api/health. Status health tidak berarti agent atau Hermes aktif. Loading, offline, kegagalan health dan retry harus memiliki teks jelas. Tidak membuat task/approval, database, jadwal salat, atau setting persisten.

## Langkah dan acceptance

- [x] Uji terlebih dahulu pemetaan hash, fallback route, health payload/error dan tampilan shell.
- [x] Buat navigasi, overview, reference office, halaman agent dan placeholder task/approval/monitoring/log/settings.
- [x] Implementasikan health status dengan timeout, cleanup request, retry dan online/offline.
- [x] Panel tim: enam nama/peran + dialog detail; bukan agent aktif.
- [x] Sidebar desktop, menu responsif, skip link, heading focus, aria-current dan reduced motion.
- [x] Typecheck/build/lint/test + browser pada 390/768/1280, route/back, Escape/dialog dan backend error/recovery. Offline jaringan OS dan audit keyboard menyeluruh belum diuji; lihat laporan.
- [x] Cocokkan semua hash aset, perbarui TASKS/README/laporan; tanpa commit/push/deploy.

## File

apps/web/src/App.tsx, styles.css, shell/navigation.ts, shell/health.ts, shell/use-health.ts, shell/content.tsx, shell/team.ts, test colocated; apps/web/vite.config.ts untuk proxy dev. Docs UI-001_REPORT.md berisi hasil aktual.
