# PRD — 204. PROJECT GROUP

Tanggal: 26 Oktober 2026. Status: rancangan produk; implementasi saat ini terbatas pada fondasi development. Kantor interaktif, workflow, database, realtime dan AI di bawah ini **belum diimplementasikan**. Hasil setup aktual hanya dinyatakan dalam SETUP_REPORT.md.

## Visi dan pengguna

204. PROJECT GROUP adalah kantor virtual web bergaya pixel-art chibi isometrik untuk satu CEO manusia yang mengarahkan enam AI Agent. Tujuannya memberi visibilitas atas pekerjaan, keputusan dan biaya tanpa menyamakan aktivitas visual dengan pekerjaan nyata. Pengguna utama adalah Leo sebagai pemilik/CEO; enam agent merupakan pelaksana dengan izin terbatas, bukan akun pemilik tambahan.

| Nama   | Posisi dan tanggung jawab rancangan                                                         |
| ------ | ------------------------------------------------------------------------------------------- |
| Leo    | CEO — Human Owner; menetapkan tujuan, anggaran, izin dan keputusan akhir                    |
| Akira  | General Manager / Lead Coordinator; merencanakan dan mendistribusikan tugas melalui backend |
| Aeri   | Brand Ambassador / Social Media; usulan komunikasi dan konten                               |
| Amy    | Digital Marketing Specialist; analisis dan rencana pemasaran                                |
| Kuro   | Art Director / Lead Designer; arahan dan keluaran desain                                    |
| Mail   | Finance Manager; analisis biaya dan laporan keuangan                                        |
| Zegion | Technology / Security / Reliability; analisis teknis, keamanan dan reliabilitas             |

Leo bukan AI Agent ketujuh. Nama dan identitas visual mengikuti referensi karakter yang tersedia.

## Lingkup dan prioritas

Tahap saat ini hanya dokumentasi, audit Windows, monorepo pnpm, halaman nama produk, backend health, konfigurasi dan pengujian dasar. Tidak termasuk kantor, animasi, integrasi Hermes, database aktif, deployment maupun commit/push otomatis.

MVP produk sesudah persetujuan CEO mencakup app shell, kantor delapan area, enam representasi agent, task dan approval simulasi, detail pekerjaan dan monitoring koneksi. Simulasi wajib diberi label “Simulasi”; tidak menyatakan pekerjaan AI sungguhan. Backend persisten dan realtime mengikuti stabilisasi simulasi; satu integrasi AI nyata diuji sebelum enam agent. Tauri dan publikasi adalah fase lanjutan.

## Kebutuhan fungsional

| ID    | Kebutuhan                                                                                                          | Prioritas produk          |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| FR-01 | CEO membuat instruksi dengan tujuan, batas lingkup, keluaran, tenggat dan batas biaya                              | P0                        |
| FR-02 | Akira mengusulkan pembagian tugas, dependensi, penanggung jawab dan estimasi; backend memvalidasi                  | P0                        |
| FR-03 | Task board menampilkan status, progres berbasis langkah terverifikasi, blokir dan hasil                            | P0                        |
| FR-04 | Dashboard menampilkan pekerjaan, aktivitas agent, approval/revisi, riwayat, biaya, log dan status sistem           | P0                        |
| FR-05 | Inbox approval menampilkan versi hasil, alasan, dampak, biaya dan pilihan setuju/minta revisi/tolak                | P0                        |
| FR-06 | Hanya keputusan CEO yang sah dapat melepas aksi berizin; semua perubahan tercatat                                  | P0                        |
| FR-07 | Kantor mempertahankan tepat delapan area; karakter berinteraksi sesuai state visual                                | P1                        |
| FR-08 | Detail agent menampilkan peran, task aktif, antrean, kendala, biaya dan aktivitas terbaru                          | P1                        |
| FR-09 | Pengingat Subuh, Dzuhur, Ashar, Maghrib, Isya dapat dikonfigurasi lokasi, zona waktu, metode dan koreksi per waktu | P1                        |
| FR-10 | Notifikasi dan pengingat dapat ditandai dibaca, ditunda atau dimatikan; preferensi tersimpan pada fase persisten   | P1                        |
| FR-11 | Monitoring AI memisahkan estimasi dan biaya aktual serta memperlihatkan provider error dan batas anggaran          | P0 sebelum AI nyata       |
| FR-12 | Reconnect memulihkan state resmi lewat snapshot dan event lanjutan tanpa menggandakan keputusan                    | P0 sebelum realtime nyata |

## Workflow dan status

CEO memberikan instruksi → Akira menganalisis kebutuhan → Akira membagi tugas → agent mengerjakan → hasil direview → jika kebijakan memerlukan, masuk Approval Room/inbox → CEO menyetujui atau meminta revisi → pekerjaan difinalisasi. Hasil yang tidak memerlukan approval tetap divalidasi sesuai kebijakan backend sebelum selesai.

State domain task yang direncanakan: draft → queued → running → in_review → awaiting_approval → completed. Cabang: blocked, revision_requested (kembali queued setelah revisi disiapkan), failed, cancelled. Penyelesaian hanya sesudah bukti hasil dan persetujuan yang diperlukan valid. Transisi harus memeriksa versi task dan izin. Progres bukan persentase animasi atau waktu berjalan.

State avatar terpisah: idle, walking, working, sitting, reviewing, awaiting_visual_approval, on_break. Avatar menuju workstation saat bekerja, dapat ke Approval Room saat menunggu keputusan, dan menuju area istirahat saat tidak ada pekerjaan. Kegagalan pathfinding atau avatar yang belum sampai ruangan tidak mengubah task. Pengingat ibadah dan animasi istirahat tidak menghentikan proses backend.

## Delapan area tetap

| Area           | Fungsi rancangan                                          |
| -------------- | --------------------------------------------------------- |
| Lobby          | Ringkasan kehadiran dan orientasi kantor                  |
| Main Workspace | Workstation dan akses detail agent/pekerjaan              |
| Approval Room  | Representasi antrean keputusan; membuka inbox CEO         |
| Command Room   | Dashboard CEO, instruksi dan status sistem                |
| Mushola        | Pengingat dan preferensi ibadah; kegiatan visual opsional |
| Break Lounge   | Aktivitas istirahat saat idle                             |
| Garden         | Area istirahat visual                                     |
| Pool Area      | Area relaksasi visual; batas collision aman               |

Tidak ada ruang tambahan tanpa persetujuan CEO.

## User stories dan kriteria penerimaan produk

1. Sebagai Leo, saya dapat membuat instruksi dan melihat pembagian Akira agar tanggung jawab jelas. Diterima bila setiap subtask memiliki owner, dependensi dan hubungan ke instruksi serta penolakan input terlihat.
2. Sebagai Leo, saya dapat menilai versi hasil sebelum menyetujui. Diterima bila keputusan merekam identitas, waktu, versi hasil dan alasan; hasil yang berubah membatalkan approval lama dan permintaan ulang tidak menggandakan aksi.
3. Sebagai Leo, saya dapat mengetahui pekerjaan yang macet. Diterima bila blocked/failed menjelaskan alasan, langkah pemulihan dan aktivitas terakhir tanpa mengarang progres.
4. Sebagai Leo, saya dapat membatasi biaya. Diterima bila backend menolak eksekusi yang melewati batas dan menampilkan biaya aktual terpisah dari estimasi; penggunaan serentak tidak melewati reservasi anggaran.
5. Sebagai pengguna, saya tetap memahami keadaan saat koneksi putus. Diterima bila UI menunjukkan offline/stale, keputusan berisiko dinonaktifkan dan reconnect memulihkan snapshot terurut.
6. Sebagai pengguna keyboard, saya dapat mengakses pekerjaan dan approval tanpa canvas. Diterima bila panel DOM menyediakan aksi setara, fokus terlihat dan pesan status terbaca pembaca layar.
7. Sebagai Leo, saya dapat mengatur pengingat ibadah. Diterima bila lima waktu, zona waktu IANA, sumber/metode, tanggal jadwal serta koreksi ditampilkan; jadwal gagal dihitung memberi error dan tidak menghentikan task.

## Kebutuhan nonfungsional dan target validasi

- Windows desktop browser menjadi prioritas; target layout 1280×720 dan 1920×1080, tetap dapat dipakai pada 768 px dan mobile melalui panel bertumpuk. Matriks browser dan perangkat disahkan saat fase UI.
- Target awal simulasi 60 FPS pada perangkat uji yang dicatat; minimum 30 FPS untuk mode hemat. Ukur scene delapan area, batasi render ketika tab tersembunyi dan sediakan reduced motion. Target bukan hasil benchmark saat ini.
- Target API lokal health merespons <500 ms pada persentil 95 dalam beban uji yang didefinisikan; endpoint produk mempunyai pengukuran terpisah. Tidak ada klaim SLA production saat ini.
- UI non-canvas mengikuti WCAG 2.2 AA sebagai sasaran; kontras teks minimal 4,5:1 dan elemen kontrol 3:1, target interaksi minimal 24 px (ideal 44 px), status tidak bergantung pada warna.
- Semua tanggal disimpan UTC dan ditampilkan dengan zona waktu konfigurasi. Data domain memakai schema bersama dan revisi eksplisit. Error tidak membocorkan secret.
- Pemulihan mencakup backup/restore SQLite yang diuji sebelum penggunaan data penting; audit keputusan tidak dihapus lewat aksi agent.

## Keamanan dan batas izin

Backend adalah otoritas task, approval, anggaran dan eksekusi. Frontend maupun Hermes hanya meminta aksi. CEO terautentikasi memiliki izin keputusan; agent memakai identitas dan allowlist alat per peran. Agent tidak boleh menambah izin, menaikkan budget, mengubah kebijakan approval atau mengeksekusi shell bebas. Publikasi, pengiriman pesan, transaksi dan perubahan eksternal memerlukan izin eksplisit yang diperiksa backend. Aksi di luar lingkup ditolak, bukan “disetujui” oleh animasi.

Credential disimpan hanya di server melalui environment/penyimpanan secret, tidak dikirim ke browser, log, repository atau portrait. Terapkan validasi Zod, rate limit, origin allowlist, timeout, pembatasan ukuran input, redaksi log, isolasi adapter dan pembatasan biaya keras. Detail kontrak keamanan ada di ARCHITECTURE.md; fondasi health bukan implementasi keamanan production.

## Risiko dan metrik keberhasilan

Character sheet belum sprite runtime; pemotongan, transparansi, anchor dan animasi memerlukan validasi manual. Denah adalah referensi, bukan tilemap/collision siap pakai. Gerak karakter dapat menyesatkan; label status domain selalu dominan. Biaya/model dan kegagalan provider dapat berubah; gunakan budget server, timeout dan bukti biaya. Jadwal ibadah dipengaruhi metode/lokasi; tampilkan sumber dan koreksi. SQLite membatasi pola tulis serentak; uji beban sebelum memperluas deployment.

Metrik fase produk: keberhasilan workflow dari instruksi ke hasil, waktu keputusan CEO, tingkat revisi, task blocked, selisih biaya estimasi/aktual, pemulihan reconnect dan aksesibilitas keyboard. Baseline dan ambang numerik ditetapkan sebelum pilot AI, bukan direkayasa dari setup awal.

## Fase lanjutan dan gate

Ikuti TASKS.md: dokumentasi/setup → shell → satu ruang → satu karakter → pathfinding → delapan area → workflow simulasi → ibadah/istirahat → backend/database/realtime → satu AI → enam AI → Tauri/deployment. Setiap fase implementasi berikutnya menunggu persetujuan CEO. Integrasi eksternal, perubahan ruang, instalasi sistem, commit/push dan deployment bukan bagian izin fondasi ini.
