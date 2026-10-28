# Arsitektur — 204. PROJECT GROUP

Status (28 Oktober 2026): fondasi backend sudah ada. Server Fastify memegang login Leo, API task (buat, langkah, keputusan), unggah file, dan penyimpanan SQLite. Aturan workflow ada di `packages/contracts` dan dipakai server dan web. Realtime memakai Server-Sent Events (`GET /events`, server memberi tahu bahwa data berubah dan browser membaca ulang daftar); tabel audit permanen, sesi di database, dan kunci idempotensi sudah ada. Belum ada: agent nyata (Hermes), integrasi Obsidian dan platform eksternal. Versi yang benar-benar terpasang dibaca dari package.json dan pnpm-lock.yaml.

## Keputusan teknologi

| Bagian           | Teknologi                          | Tahap                                                     |
| ---------------- | ---------------------------------- | --------------------------------------------------------- |
| UI dan bahasa    | React + TypeScript strict          | Fondasi                                                   |
| Build dan style  | Vite + Tailwind CSS                | Fondasi                                                   |
| Peta kantor      | Gambar isometrik + lapisan SVG     | Terpasang; Phaser dan Tiled tidak dipakai lagi            |
| Server           | Node.js + Fastify                  | Fondasi, REST GET /health                                 |
| Validasi/kontrak | Zod + TypeScript                   | Fondasi; schema domain nanti                              |
| Real-time        | WebSocket                          | Rencana; tidak perlu aktif sekarang                       |
| Persistensi      | SQLite bawaan Node (`node:sqlite`) | Terpasang untuk task dan file; migrasi bertahap belum ada |
| Test             | Vitest                             | Fondasi                                                   |
| E2E              | Playwright                         | Fase UI/workflow berikutnya                               |
| Desktop          | Tauri                              | Fase akhir; Rust/C++/WebView2 hanya diaudit sekarang      |
| Orkestrasi AI    | Hermes Adapter                     | Kontrak pemisah; belum integrasi nyata                    |
| Workspace        | pnpm, satu lockfile root           | Fondasi                                                   |

Audit awal menggunakan Node.js 22.20.0 yang tersedia; pemilihan dependency mengikuti metadata registry/dokumentasi resmi dan engine aktual, bukan tebakan “latest”. Konflik major/engine harus dijelaskan sebelum mengganti stack atau memasang tool sistem. Tidak ada kebutuhan Docker/Python/Rust untuk health dan halaman awal.

## Struktur dan tanggung jawab

Root tetap D:\Project-Office starup, tanpa direktori proyek bersarang.

```text
apps/web/                 React, DOM UI, routing, client REST/realtime
apps/server/              Fastify, application services, auth, policy, health
packages/contracts/      schema Zod, DTO, event envelope; tanpa secret
packages/simulation/     Phaser scenes, grid, avatar dan mapping visual
packages/agent-adapters/  interface orchestration dan implementasi adapter nanti
assets/source/           sumber turunan yang berprovenance
assets/runtime/          atlas/map runtime yang sudah divalidasi
Img/                     referensi asli, tidak diubah
docs/                    perencanaan, setup, bukti validasi
tests/                   skenario lintas package nanti
```

Presentation layer merender state dan meminta aksi. Office simulation menerima proyeksi state domain dan mengelola kamera, gerak, collision, animasi. Task workflow mendefinisikan transisi, review, dependensi dan kebijakan approval. Backend application memvalidasi identitas/izin, transaksi dan orkestrasi. Database menyimpan state resmi/audit. Adapter menerjemahkan perintah terbatasi ke provider Hermes tanpa ketergantungan UI pada SDK provider.

Dependency yang diizinkan: web → contracts/simulation; simulation → contracts tipe/proyeksi minimal, bukan server; server → contracts/agent-adapters/repository. Contracts tidak mengimpor aplikasi. Adapter tidak mengimpor React/Phaser. Frontend tidak mengakses database atau credential provider. Folder kosong atau kontrak placeholder tidak berarti fitur telah tersedia.

## Dua state yang berbeda

Task domain memiliki ID, parent, owner, status, revision, dependency IDs, output references, timestamps dan budget reference. Backend adalah sumber kebenaran. Contoh `running` tidak berubah menjadi `completed` karena sprite berhenti mengetik.

Avatar memiliki agentId, posisi, tujuan, arah, animasi, visual intent dan path. State ini bersifat presentasi: boleh gagal/direkonstruksi tanpa kehilangan pekerjaan. Mapping `awaiting_approval → menuju titik Approval Room` hanya intent. Kedatangan avatar bukan syarat approval, dan pengingat Mushola/istirahat tidak menghentikan job. React tidak mengirim update setiap frame ke server; simulasi memakai loop sendiri dan event terpilih untuk UI.

## Kontrak REST yang direncanakan

Saat ini hanya GET /health wajib tersedia. Endpoint domain berikut adalah rancangan, belum route aktif: POST /instructions; GET/POST /tasks; GET /tasks/:id; POST /tasks/:id/transitions; GET /approvals; POST /approvals/:id/decisions; GET /agents; GET /activity; GET /usage; GET/PATCH /settings; GET /snapshot.

Zod memvalidasi body, query, params dan response boundary. Mutation memakai request/idempotency key dan expectedVersion; konflik menghasilkan 409 beserta cara refresh, input salah 400, belum login 401, tidak berizin 403, limit 429. Error body aman: code, message, requestId dan detail field yang diizinkan. Tidak tersedia endpoint untuk perintah sistem bebas, arbitrary shell, arbitrary file read atau URL proxy tak terbatas. Health tidak membocorkan env, key atau topologi internal.

## Event, reconnect dan snapshot

Envelope rancangan:

```ts
type DomainEvent<T> = {
  id: string; // UUID unik untuk deduplikasi
  type: string; // misalnya task.status.changed
  timestamp: string; // ISO 8601 UTC dari server
  schemaVersion: number; // versi kontrak payload
  streamId: string; // lingkup kantor/owner
  sequence: number; // urutan monotonik per stream
  aggregateId: string;
  aggregateVersion: number;
  correlationId: string;
  payload: T;
};
```

Server menetapkan timestamp/sequence/version. Event contoh: task.created, task.status.changed, approval.requested, approval.decided, agent.run.changed, usage.updated, system.status.changed. Hindari memasukkan prompt/secret mentah ke event browser. Transport boleh mengirim ulang; konsumsi harus idempotent dan dedupe berdasarkan id, jangan mengasumsikan exactly-once.

Saat awal, client mengambil snapshot konsisten berisi schemaVersion, streamId, snapshotVersion, lastSequence, generatedAt dan state yang boleh dilihat CEO. Client lalu berlangganan event `afterSequence=lastSequence`; server menyediakan replay atau menuntut snapshot baru jika retensi habis. Snapshot dan cursor harus konsisten untuk menutup race. Terapkan hanya sequence berikutnya; gap/out-of-order memicu buffering terbatas dan resync. Event versi schema tak didukung memicu refresh/upgrade yang jelas.

Disconnect menunjukkan stale dan menonaktifkan keputusan yang membutuhkan state segar. Reconnect exponential backoff dengan jitter dan batas; gunakan heartbeat/ping serta validasi sesi ulang. Sesudah reconnect, ambil replay atau snapshot baru, terapkan domain dahulu, rekonstruksi intent visual kemudian. Idempotency key memastikan klik ulang setelah response hilang tidak menggandakan keputusan/biaya. Kebijakan retensi event, buffer, heartbeat dan ukuran snapshot ditentukan dan diuji di BACKEND-004.

## Persistensi dan transaksi yang direncanakan

Entitas: owners/sessions, agents, instructions, tasks, task_dependencies, task_outputs (versi dan referensi artefak), approvals/decisions, agent_runs, usage_ledger, budget_reservations, settings, audit_events dan event_outbox. ID stabil, timestamp UTC, relasi/constraint dan optimistic revision wajib. Jangan simpan atlas atau base64 gambar besar pada row task.

SQLite cocok untuk fase satu pemilik pada satu server. Evaluasi WAL, busy timeout, foreign keys dan pola satu writer; jangan berbagi file SQLite lewat filesystem jaringan. Drizzle tetap kandidat sampai driver, migrasi dan runtime dipilih berdasar kompatibilitas resmi. Migrasi versioned, rollback/recovery terdokumentasi dan backup/restore diuji. Gunakan repository interface agar penggantian storage tidak mempengaruhi UI/adapter.

Perubahan task + audit + outbox dilakukan dalam satu transaksi. Publisher membaca outbox setelah commit dan dapat retry; konsumen dedupe. Approval decision memeriksa actor CEO, expected task/output version dan status pending secara atomik, sehingga dua tab tidak melepas aksi dua kali. Output baru membutuhkan keputusan baru bila approval lama tidak mencakup versi tersebut.

## Autentikasi, authorization dan keamanan

Fondasi lokal health bukan sistem login production. Sebelum endpoint domain aktif, implementasikan autentikasi satu CEO melalui sesi server: cookie HttpOnly, Secure pada HTTPS dan SameSite sesuai deployment, expiry/rotation serta logout/revocation. Lindungi mutation cookie dari CSRF dengan token/origin checks. CORS development allowlist origin frontend yang dikonfigurasi, bukan wildcard credentials; bind lokal sebagai default. WebSocket memverifikasi origin dan sesi pada handshake/reconnect.

Authorization ditetapkan backend per aksi/resource. CEO mengelola budget, izin dan approval. Akira mengusulkan distribusi; agent hanya mengakses task/alat yang diizinkan. Semua publikasi, komunikasi eksternal, transaksi, perubahan credential/izin dan operasi berdampak wajib kebijakan izin eksplisit. Tool allowlist, schema input, timeout, kuota, network allowlist dan ukuran hasil membatasi adapter. Prompt injection dari konten luar dianggap data tidak terpercaya, tidak boleh mengubah izin atau mengabaikan keputusan CEO.

Secret provider berada di env server atau secret store, tidak pada VITE_* atau contracts. .env.example hanya placeholder aman; .env, log berisi data pribadi dan database lokal diabaikan Git. Redaksi authorization/cookie/API key dan isi sensitif di log/error. Terapkan TLS untuk deployment, validation, rate limit per identitas/IP, request body limits, timeout, dependency audit dan error handler tanpa stack internal untuk client. Tidak ada instalasi global atau script remote tanpa verifikasi.

## Hermes Adapter dan biaya

Interface rancangan mencakup capability discovery, submitRun, getRun, cancelRun bila didukung, streamEvents dan normalizeUsage. Input membawa task/version, instruksi terbatasi, izin, budget reservation, correlationId dan timeout. Output bertipe result/error/usage; adapter tidak berwenang menetapkan completed atau approval sendiri. Kontrak membedakan cancellation requested, cancellation confirmed dan provider yang tidak mendukung pembatalan.

Mulai adapter palsu deterministik untuk simulasi; label sumber `simulation`. Integrasi satu agent nyata memerlukan gate CEO, credential server dan uji kegagalan. Backend melakukan preflight estimasi, reservasi budget atomik, pembatasan token/waktu/retry, rekonsiliasi biaya aktual dan penolakan saat batas habis. Usage yang belum diketahui diberi status unknown/pending, bukan nol. Retry tidak otomatis pada aksi eksternal tak idempotent. Enam agent baru diaktifkan setelah uji satu agent, concurrency limit, budget race dan circuit breaker.

## Observabilitas dan pengujian

Log JSON terstruktur memiliki level, waktu UTC, requestId/correlationId, actor aman dan kode error. Audit keputusan terpisah dari log diagnostik, mencatat versi dan alasan. Ukur latency/error API, reconnect/gap, task backlog, run timeout, biaya/reservasi dan FPS; jangan mengirim telemetry eksternal tanpa kebijakan yang disetujui.

Fondasi: install, typecheck, build web/server, lint, Vitest, HTTP health, startup frontend, pemeriksaan aset asli dan secret. Fase domain: tes transisi ilegal, hak akses, approval versi stale/idempotensi, transaksi/rollback, event gap/replay, budget concurrent, adapter timeout/redaksi. Simulasi: mapping koordinat, collision, path blocked, anchor dan lifecycle destroy Phaser. Playwright nanti menguji keyboard, responsive, approval/reconnect; tidak perlu dipasang untuk halaman awal. Hasil nyata dicatat SETUP_REPORT.md, bukan diasumsikan dari rancangan ini.

## Development dan gate berikutnya

pnpm workspace memakai satu lockfile dan script root dev/build/lint/typecheck/test. Dependency dipin oleh lockfile; runtime dan cara bootstrap Windows mengikuti SETUP.md. Fastify health dan Vite dapat berjalan terpisah; konfigurasi port/origin melalui env yang aman. TypeScript strict di seluruh package, ESLint/Prettier konsisten. Nama komponen PascalCase, util/module kebab-case, test *.test.ts(x), schema/DTO eksplisit tanpa any lintas batas.

Tauri, packaging/signing, backup production, TLS, hosting dan deployment menjadi pekerjaan DEPLOY setelah approval; jangan memasang Rust/Build Tools sekarang. Tidak membuat remote, commit, push atau deployment otomatis. Persetujuan CEO diperlukan sebelum fitur interaktif atau integrasi sungguhan dimulai.
