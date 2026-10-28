# Roadmap dan task — 204. PROJECT GROUP

Pembaruan: 27 Oktober 2026. Prioritas: P0 wajib pada fase terkait, P1 berikutnya, P2 lanjutan. M0 dan UI-001 selesai. Instruksi lanjutan CEO mengizinkan pratinjau Main Workspace dan satu karakter bergerak; hasil di OFFICE-001_REPORT.md. Map delapan area kini tersedia; hasil lanjutannya di MAP-002_REPORT.md. Fase lainnya menunggu review. Dependencies adalah ID task prasyarat, bukan izin otomatis untuk menjalankannya.

## Milestone dan gate

M0 dokumentasi/setup → M1 shell → M2 satu ruang → M3 satu karakter → M4 pathfinding/animasi → M5 delapan area → M6 workflow simulasi → M7 Mushola/istirahat → M8 backend/database/realtime → M9 satu AI → M10 enam AI → M11 Tauri/deployment. M2 tersedia sebagai pratinjau prosedural; M3–M4 parsial untuk satu sprite referensi dan gerak dasar. M5 hampir lengkap: map delapan area dan tujuh karakter tersedia, panel fungsi ruangan belum. M6 parsial: workflow task dan approval berupa simulasi di browser; PRAYER-001 dan seterusnya belum dimulai.

## M0 — Dokumentasi dan fondasi yang diizinkan sekarang

### DOC-001 — Spesifikasi produk

- Tujuan: menyepakati lingkup, enam AI dan Leo manusia.
- Deskripsi: susun visi, requirements, workflow, izin, risiko dan acceptance criteria.
- Prioritas: P0.
- Dependencies: master instruction dan audit referensi.
- File/modul: docs/PRD.md.
- Acceptance criteria: delapan area tetap; status task/avatar terpisah; MVP dan larangan tahap sekarang eksplisit.
- Status: dokumen selesai disusun dan diverifikasi; keputusan produk menunggu review CEO.
- Risiko: rancangan disalahartikan fitur aktif.

### DOC-002 — Spesifikasi desain

- Tujuan: mempertahankan identitas kantor dan karakter.
- Deskripsi: dokumentasikan layar, state, aksesibilitas, responsif, sprite, gerak dan room interaction.
- Prioritas: P0.
- Dependencies: DOC-001, referensi Img/.
- File/modul: docs/DESIGN.md.
- Acceptance criteria: putih/hitam/emas/hijau, isometrik, PNG transparan/anchor/FPS, semua state UI, akses DOM setara canvas.
- Status: dokumen selesai disusun dan diverifikasi; keputusan desain menunggu review CEO.
- Risiko: sheet referensi tidak dapat langsung dianimasikan.

### DOC-003 — Arsitektur dan kontrak awal

- Tujuan: memisahkan simulasi dari otoritas pekerjaan.
- Deskripsi: tetapkan layer, stack, REST/event, auth, budget dan adapter.
- Prioritas: P0.
- Dependencies: DOC-001.
- File/modul: docs/ARCHITECTURE.md.
- Acceptance criteria: backend otoritas; reconnect/snapshot/version; secret dan izin; database/Hermes ditandai rencana.
- Status: dokumen selesai disusun dan diverifikasi; kontrak masa depan menunggu review CEO.
- Risiko: kontrak terlalu dini dianggap implementasi.

### SETUP-001 — Audit Windows dan kompatibilitas

- Tujuan: mengetahui tool yang tersedia sebelum instalasi.
- Deskripsi: audit Windows, Node/npm/pnpm/Corepack/Git/TS/Python/editor/Rust/C++/WebView2, disk, struktur dan remote; cek engine dependency dari sumber resmi.
- Prioritas: P0.
- Dependencies: tidak ada.
- File/modul: docs/SETUP.md, docs/SETUP_REPORT.md.
- Acceptance criteria: versi aktual dan ketidaktersediaan dicatat; tidak mengubah PATH atau memasang tool sistem tanpa izin.
- Status: SELESAI; environment aktual dan batas audit dicatat di SETUP_REPORT.md.
- Risiko: sandbox atau jaringan menghalangi pemeriksaan; unknown tidak boleh dianggap absent.

### SETUP-002 — Workspace dan frontend minimal

- Tujuan: aplikasi awal dapat dikembangkan pada Windows.
- Deskripsi: pnpm satu lockfile, React/TS/Vite/Tailwind, ESLint/Prettier, strict, Phaser dependency, Vitest dan halaman nama produk.
- Prioritas: P0.
- Dependencies: SETUP-001, DOC-001, DOC-002, DOC-003.
- File/modul: apps/web, packages/*, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.base.json, README.md.
- Acceptance criteria: script dev/build/lint/typecheck/test tersedia; halaman nama produk; tidak ada kantor interaktif; root tidak bersarang.
- Status: SELESAI; install, build, typecheck, lint dan tes PASS, tanpa fitur interaktif.
- Risiko: engine/plugin major tak kompatibel; wajib hentikan perubahan besar dan jelaskan.

### BACKEND-001 — Server health minimal

- Tujuan: memverifikasi runtime backend.
- Deskripsi: Fastify/TS/Zod, CORS development allowlist, error handler dan GET /health.
- Prioritas: P0.
- Dependencies: SETUP-001, DOC-003.
- File/modul: apps/server, packages/contracts, .env.example.
- Acceptance criteria: health teruji HTTP; script dev/build/typecheck/test; tidak ada endpoint shell bebas, database atau Hermes aktif.
- Status: SELESAI; health HTTP nyata dan empat tes backend PASS.
- Risiko: port bentrok atau CORS terlalu longgar.

### SETUP-003 — Quality gate fondasi

- Tujuan: menghasilkan bukti yang dapat ditinjau.
- Deskripsi: uji install/typecheck/build/lint/unit/health/frontend startup, cek hash Img dan secret ignore.
- Prioritas: P0.
- Dependencies: SETUP-002, BACKEND-001.
- File/modul: docs/SETUP_REPORT.md, .gitignore, README.md, tests/.
- Acceptance criteria: tiap check punya perintah dan PASS/FAIL/SKIPPED; versi aktual dicatat; aset tidak berubah; tidak commit/push/deploy.
- Status: SELESAI untuk quality gate fondasi; SETUP_REPORT.md mencatat PASS dan SKIPPED.
- Risiko: proses startup berhasil tetapi halaman/health belum benar; jangan klaim PASS tanpa observasi.

### DOC-004 — Roadmap dan review fondasi

- Tujuan: menyediakan urutan pembangunan beserta gate CEO.
- Deskripsi: pelihara semua task dengan tujuan, deskripsi, prioritas, dependensi, file, acceptance, status dan risiko.
- Prioritas: P0.
- Dependencies: DOC-001, DOC-002, DOC-003, SETUP-003 untuk penutupan M0.
- File/modul: docs/TASKS.md dan laporan akhir.
- Acceptance criteria: seluruh milestone tercakup; status aktual tidak mengklaim fitur rencana; berhenti sesudah M0.
- Status: roadmap selesai disusun; M0 siap ditinjau CEO, M1 belum diizinkan.
- Risiko: roadmap disalahartikan persetujuan implementasi.

## M1–M5 — Fondasi pengalaman kantor (M1 selesai; M2 pratinjau; M3–M4 parsial)

### UI-001 — App shell dan navigasi

- Tujuan: akses layar produk lewat DOM.
- Deskripsi: sidebar/header, dashboard placeholder berlabel, drawer, routing dan koneksi.
- Prioritas: P0.
- Dependencies: SETUP-003, DOC-002, persetujuan CEO M1.
- File/modul: apps/web/src, packages/contracts.
- Acceptance criteria: keyboard, responsive 390/768/1280 px, loading/error/empty/offline; belum menyatakan AI nyata.
- Status: SELESAI untuk shell lokal pada 27 Oktober 2026; hasil dan batas pengujian di UI-001_REPORT.md. Workflow/AI tetap belum aktif.
- Risiko: canvas mendominasi navigasi aksesibel.

### OFFICE-001 — Satu ruang percobaan

- Tujuan: memvalidasi pipeline peta isometrik.
- Deskripsi: buat satu ruang prosedural berbasis grid dan lifecycle scene Phaser; authoring Tiled ditunda sampai kebutuhan perluasan jelas.
- Prioritas: P0.
- Dependencies: UI-001.
- File/modul: apps/web/src/office/model.ts, scene.ts, Office.tsx, office.css.
- Acceptance criteria: ruang tampil, pan/zoom, resize/destroy aman, proyeksi dan depth benar; Img tidak berubah.
- Status: PRATINJAU TERIMPLEMENTASI; Main Workspace, enam meja, tanaman, pan/zoom, resize dan cleanup. Belum replika denah lengkap; rincian verifikasi di OFFICE-001_REPORT.md.
- Risiko: gambar denah bukan tilemap runtime.

### SPRITE-001 — Satu karakter chibi runtime

- Tujuan: membuktikan kelayakan aset animasi.
- Deskripsi: audit/potong/buat atlas satu karakter dengan manifest dan portrait; minta keputusan bila perlu authoring baru.
- Prioritas: P0.
- Dependencies: OFFICE-001, DOC-002.
- File/modul: assets/source/characters, assets/runtime/characters, packages/simulation.
- Acceptance criteria: transparansi, anchor, frame size/directions, outline, skala furnitur dan identitas lolos QA visual.
- Status: SELESAI untuk tujuh karakter; atlas transparan tiga arah (bawah, samping, atas) dan portrait dibuat oleh scripts/build-sprites.mjs ke assets/runtime/characters. Arah samping lainnya memakai flip. Belum ada animasi kerja/duduk. Lihat MAP-002_REPORT.md.
- Risiko: sheet tidak punya cukup frame/arah; jangan mengarang kesiapan.

### OFFICE-002 — Pathfinding, collision dan animasi

- Tujuan: gerak yang konsisten tanpa mengubah task.
- Deskripsi: nav grid, reservasi tujuan, idle/walk/work/sit/review/approval/break dan fallback buntu.
- Prioritas: P0.
- Dependencies: OFFICE-001, SPRITE-001.
- File/modul: packages/simulation, assets/runtime/maps.
- Acceptance criteria: tidak menembus furniture/dinding; occlusion benar; FPS target diukur; task tetap ketika path gagal.
- Status: PARSIAL; logika gerak dipisah ke walker.ts dan dites, dengan BFS grid, antrean tujuan, karakter lain sebagai penghalang dan occlusion furnitur. Pose work/sit/review/approval/break, reservasi tujuan multi-karakter dan pengukuran FPS belum dikerjakan.
- Risiko: sprite/animasi tidak sinkron, deadlock jalur.

### OFFICE-003 — Delapan area dan tujuh representasi

- Tujuan: menerapkan kantor resmi secara utuh.
- Deskripsi: Lobby, Main Workspace, Approval Room, Command Room, Mushola, Break Lounge, Garden, Pool Area; enam AI dan Leo manusia.
- Prioritas: P1.
- Dependencies: OFFICE-002, persetujuan hasil satu karakter untuk perluasan.
- File/modul: assets/source/maps, assets/runtime, packages/simulation, apps/web.
- Acceptance criteria: tepat delapan area, workstation owner jelas, akses panel tiap ruang, semua karakter lulus QA; tiada ruang tambahan.
- Status: PARSIAL; peta isometrik interaktif delapan zona dengan panel detail per zona (spesifikasi, bukan fungsi kerja). Karakter berjalan dihapus sementara; panel fungsi ruangan belum dibuat.
- Risiko: biaya authoring enam karakter dan performa scene.

## M6–M7 — Workflow simulasi dan aktivitas (belum diizinkan)

### TASK-001 — Task workflow simulasi

- Tujuan: menguji alur instruksi dan distribusi tanpa AI sungguhan.
- Deskripsi: state machine, dependensi, board/detail/riwayat memakai fake service deterministik.
- Prioritas: P0.
- Dependencies: OFFICE-003, UI-001.
- File/modul: packages/contracts, apps/web, tests/.
- Acceptance criteria: instruksi→Akira→owner→review; transisi ilegal ditolak; label Simulasi; progres tidak berasal dari animasi.
- Status: SIMULASI SELESAI (apps/web/src/tasks); instruksi→Akira→owner→review→Leo, transisi ilegal ditolak, berlabel Simulasi, data di memori. Task board berbentuk papan kanban lima kolom (Masuk, Dianalisis, Dikerjakan, Review, Selesai) dan halaman Riwayat & log menampilkan semua kejadian task dengan saringan. Instruksi dapat membawa lampiran foto, dokumen, dan media (disimpan di server, dicek dari isinya). Task kini tersimpan di SQLite lewat API server dengan login Leo (BACKEND-002/003 sebagian: belum ada audit permanen, realtime, atau idempotency key). Ringkasan menampilkan statistik dan grafik dari task simulasi. Belum terhubung ke avatar di peta, backend, atau AI.
- Risiko: fake state bocor sebagai klaim backend/AI aktif.

### APPROVAL-001 — Approval/revisi simulasi

- Tujuan: menguji keputusan CEO atas versi hasil.
- Deskripsi: inbox, hasil, alasan revisi, konflik versi dan event visual Approval Room.
- Prioritas: P0.
- Dependencies: TASK-001.
- File/modul: apps/web, packages/contracts, packages/simulation.
- Acceptance criteria: approve/revisi/tolak jelas; klik ulang idempotent di fake; output baru membatalkan approval lama; avatar tidak mengesahkan keputusan.
- Status: SIMULASI SELESAI; setujui/revisi/tolak per versi hasil, klik ulang idempoten, hasil baru membatalkan approval lama. Belum otorisasi server.
- Risiko: UI approval dianggap otorisasi server yang belum ada.

### PRAYER-001 — Jadwal Mushola dan istirahat

- Tujuan: pengingat dapat dikonfigurasi tanpa menghentikan backend.
- Deskripsi: lima waktu, lokasi/zona/metode/koreksi; preferensi suara/gerak; idle ke lounge/garden/pool.
- Prioritas: P1.
- Dependencies: OFFICE-003, APPROVAL-001.
- File/modul: apps/web, packages/simulation, packages/contracts.
- Acceptance criteria: jadwal tampil sumber/tanggal/zona; koreksi tiap waktu; error sumber jelas; mute/reduced motion; task tidak berhenti karena gerak.
- Status: BELUM DIMULAI; menunggu CEO.
- Risiko: perbedaan metode dan jadwal stale.

## M8 — Backend, database, realtime (belum diizinkan)

### BACKEND-002 — Autentikasi dan kebijakan izin

- Tujuan: membangun otoritas CEO sebelum endpoint domain.
- Deskripsi: sesi aman, CSRF/origin, authorization, rate limits, logging/redaksi dan allowlist alat.
- Prioritas: P0.
- Dependencies: APPROVAL-001, PRAYER-001, BACKEND-001.
- File/modul: apps/server/src/auth, apps/server/src/policy, packages/contracts.
- Acceptance criteria: 401/403/429 diuji; agent tidak dapat approve/menaikkan budget; secret tidak bocor; tidak ada shell endpoint.
- Status: BELUM DIMULAI; menunggu CEO.
- Risiko: salah konfigurasi session/CORS membuka akses.

### BACKEND-003 — Persistensi dan API domain

- Tujuan: state task/approval resmi dan tahan restart.
- Deskripsi: evaluasi Drizzle/driver SQLite; migrasi, repository, transaksi, audit/outbox dan REST domain.
- Prioritas: P0.
- Dependencies: BACKEND-002.
- File/modul: apps/server/src/db, apps/server/src/services, packages/contracts, migrations/.
- Acceptance criteria: workflow/revisi/version conflict/idempotensi teruji; restart menjaga data; backup restore berhasil; approval atomik sesuai output version.
- Status: BELUM DIMULAI; menunggu CEO.
- Risiko: write contention, migrasi gagal atau data hilang.

### BACKEND-004 — WebSocket dan recovery

- Tujuan: monitoring sinkron tanpa kehilangan urutan.
- Deskripsi: envelope ID/timestamp/schemaVersion/sequence, outbox replay, snapshot, heartbeat/backoff dan auth reconnect.
- Prioritas: P0.
- Dependencies: BACKEND-003.
- File/modul: apps/server/src/realtime, packages/contracts, apps/web/src/services.
- Acceptance criteria: event duplicate/gap/out-of-order/expired cursor diuji; snapshot race tertutup; dua tab tidak menggandakan approval; offline jelas.
- Status: BELUM DIMULAI; menunggu CEO.
- Risiko: replay tak terbatas, cursor race, stale state.

### UI-002 — Dashboard dan monitoring terhubung

- Tujuan: mengganti fake service dengan API resmi.
- Deskripsi: hubungkan task, agent detail, approval, riwayat/log, biaya/status dan settings.
- Prioritas: P0.
- Dependencies: BACKEND-004.
- File/modul: apps/web, tests/e2e nanti.
- Acceptance criteria: semua state layar, keyboard, respon error/konflik/reconnect; estimasi/aktual/unknown berbeda; Playwright skenario utama lulus.
- Status: BELUM DIMULAI; menunggu CEO.
- Risiko: UI mengirim mutation ulang saat reconnect.

## M9–M10 — AI nyata (belum diizinkan)

### AI-001 — Adapter dan satu agent nyata

- Tujuan: validasi Hermes secara aman dan terukur.
- Deskripsi: kontrak fake→real, capability, timeout/cancel, token/biaya, budget reservation, server secret dan satu role terpilih CEO.
- Prioritas: P0.
- Dependencies: UI-002, persetujuan eksplisit integrasi/credential/provider dan budget.
- File/modul: packages/agent-adapters, apps/server/src/orchestration, packages/contracts.
- Acceptance criteria: satu run nyata terbukti, failure/retry/unknown usage/redaksi dan batas biaya teruji; aksi berdampak menunggu izin; backend mengesahkan hasil.
- Status: BELUM DIMULAI; menunggu CEO.
- Risiko: biaya, prompt injection, kemampuan Hermes belum terverifikasi.

### AI-002 — Enam agent dan koordinasi Akira

- Tujuan: orkestrasi enam peran dengan batas tanggung jawab.
- Deskripsi: Akira mengusulkan distribusi, backend validasi dependency/izin; antrean, concurrency/circuit breaker dan total budget.
- Prioritas: P1.
- Dependencies: AI-001 dan evaluasi pilot yang disetujui CEO.
- File/modul: packages/agent-adapters, apps/server/src/orchestration, apps/web.
- Acceptance criteria: enam peran sesuai PRD, Leo bukan agent, approval tidak dapat dilewati, race budget/concurrency teruji, audit run lengkap.
- Status: BELUM DIMULAI; menunggu CEO.
- Risiko: runaway delegation, biaya serentak dan kegagalan berantai.

## M11 — Desktop dan deployment (belum diizinkan)

### DEPLOY-001 — Evaluasi dan packaging Tauri

- Tujuan: menyediakan opsi desktop Windows setelah web stabil.
- Deskripsi: evaluasi Rust/C++/WebView2, capability Tauri minimal, packaging/signing/update dan akses server.
- Prioritas: P2.
- Dependencies: AI-002, approval instalasi sistem dan packaging.
- File/modul: apps/desktop nanti, docs/SETUP.md, docs/ARCHITECTURE.md.
- Acceptance criteria: paket diuji pada Windows bersih; izin native minimal; tidak mengekspos shell; secret tetap server; strategi update terdokumentasi.
- Status: BELUM DIMULAI; menunggu CEO.
- Risiko: toolchain sistem, signing dan permukaan native.

### DEPLOY-002 — Persiapan dan pelaksanaan publikasi

- Tujuan: merilis hanya dengan persetujuan konkret CEO.
- Deskripsi: threat review, HTTPS/session, backup/restore, observabilitas, anggaran, CI dan rollback; tinjau target hosting/repository.
- Prioritas: P2.
- Dependencies: AI-002; DEPLOY-001 bila distribusi desktop dipilih; approval commit/remote/push/deploy terpisah.
- File/modul: konfigurasi CI/hosting nanti, docs/runbooks nanti.
- Acceptance criteria: staging/rollback/restore dan security gate lulus, biaya disetujui, target publikasi jelas; deployment hanya sesudah izin eksplisit.
- Status: BELUM DIMULAI; menunggu CEO.
- Risiko: data/secret terekspos, biaya hosting dan rollback tidak siap.
