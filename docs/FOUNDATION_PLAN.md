# Fondasi 204. PROJECT GROUP — rencana eksekusi

**Goal:** dokumentasi lengkap dan verifikasi web + API health lokal; berhenti sebelum fitur produk.
**Spec:** master instruction CEO terlampir 26 Oktober 2026; PRD, DESIGN, ARCHITECTURE dan SETUP.
**Architecture:** satu pnpm workspace di root existing; React/Vite terpisah dari Fastify. Packages domain placeholder saja.
**Tech stack:** TypeScript strict, React, Vite, Tailwind, Phaser dependency dormant, Fastify, Zod, Vitest.

## Batas global

- Pertahankan seluruh Img, tanpa commit/push/deploy, tanpa fitur kantor/AI.
- Tidak menginstal software sistem atau global; gunakan Node/Git/Corepack yang sudah tersedia.
- Exact versions + satu lockfile; pnpm strict peers; tanpa --force.

## Approaches

Master instruction memilih web monorepo dan desktop kemudian. Alternatif desktop-first menambah Rust dan build native sebelum diperlukan; backend-only tidak memverifikasi frontend yang diminta. Pilihan teknis minor pelaksana: pnpm10 via Corepack, TS6 karena rentang peer ESLint, placeholder tanpa package executable.

## Checklist

- [x] Audit environment, Git, registry dan aset; baseline SHA256.
- [x] Tulis dokumen produk/desain/arsitektur/task dan setup.
- [x] Buat konfigurasi workspace/web/server dan tes API serta halaman identitas.
- [x] Install dependency pinned memakai `corepack pnpm install`.
- [x] Jalankan test RED sebelum implementasi health/config/App, kemudian implementasi minimal dan GREEN.
- [x] Typecheck, build, lint, test dan format; jalankan frontend/backend dev dan smoke HTTP.
- [x] Verifikasi hash aset, ignore rahasia, struktur dan perubahan Git; tulis SETUP_REPORT aktual.

## Review focus

Origin tidak dipercaya tidak mendapat CORS; port/origin tidak valid gagal startup; error tak terduga tidak membocorkan detail; jalur dengan spasi bekerja di Windows; status halaman tidak menyatakan AI aktif. Test dimiliki app.test.ts/App.test.tsx dan smoke manual. Tidak ada commit sebagai bagian rencana ini sesuai larangan CEO.
