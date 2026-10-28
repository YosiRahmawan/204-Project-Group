# Hasil pratinjau Main Workspace

27 Oktober 2026. Kelanjutan setelah UI-001 atas instruksi pengguna.

## Tersedia

- Halaman Kantor virtual memuat scene Phaser secara lazy: satu Main Workspace isometrik, enam meja, monitor, tanaman dan dinding belakang.
- Akira tampil dari texture frame sheet referensi asli, dengan frame berjalan percobaan. Blending runtime menyamarkan latar putih; belum atlas produksi transparan.
- Klik lantai atau empat tombol tujuan untuk bergerak. BFS memilih jalur empat arah menghindari meja/tanaman dan batas ruangan. Tujuan baru menunggu segmen aktif selesai agar tidak memotong sudut meja.
- Zoom, pan tombol/mouse, reset kamera, jeda/lanjut dan preferensi reduced motion. Pada reduced motion, perpindahan langsung diterapkan hanya ketika gerak tidak dijeda.
- Lifecycle React membatalkan async mount setelah unmount, melepas ResizeObserver dan menghancurkan game. Snapshot posisi/kamera belum dipersistensikan; membuka ulang kantor memulai pratinjau dari pintu masuk.
- Referensi denah lengkap tetap tersedia dalam disclosure. Status AI tetap belum aktif.

## Verifikasi

| Pemeriksaan                                     | Hasil                                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Tes awal sebelum model dibuat                   | FAIL sesuai harapan: modul model belum ada                                                                |
| `corepack pnpm test` setelah perubahan akhir    | PASS: 5 file, 10 tes                                                                                      |
| `corepack pnpm typecheck`                       | PASS; build akhir juga menjalankan pemeriksaan TypeScript                                                 |
| `corepack pnpm build`                           | PASS frontend/backend; peringatan ukuran chunk Phaser 1.37 MB (gzip sekitar 359 KB)                       |
| `corepack pnpm lint`                            | PASS, tanpa peringatan                                                                                    |
| Browser: tombol tujuan dan klik lantai          | PASS: Akira tiba di lokasi baru; tujuan terhalang menampilkan pesan                                       |
| Browser: jeda, antre tujuan, lanjut             | PASS dalam mode animasi normal                                                                            |
| Browser: zoom, pan tombol dan reset             | PASS secara visual                                                                                        |
| Browser: viewport 390 × 844                     | PASS: clientWidth dan scrollWidth 375 px, tidak overflow horizontal; viewport dikembalikan                |
| Browser: keluar ke Ringkasan, kembali ke kantor | PASS: canvas 1 → 0 → 1                                                                                    |
| Hash delapan aset asli dibanding baseline       | PASS: seluruhnya tidak berubah                                                                            |
| Review sumber independen                        | Dua temuan diperbaiki: pause/reduced-motion dan start pengujian negatif yang sebelumnya terhalang tanaman |

Pemeriksaan reduced-motion via pengaturan browser/OS, screen reader, perangkat sentuh fisik, simulasi kegagalan GPU/aset, profil FPS, dan tes browser otomatis belum dilakukan. Mouse drag tersedia tetapi bukti pan manual menggunakan tombol. Tidak mengklaim seluruh state animasi atau performa produksi lulus.

Pratinjau memakai server development yang sudah berjalan di port 5173/3001. Percobaan memulai server baru menemui EADDRINUSE, sehingga menggunakan server yang ada tanpa menghentikan proses pengguna.

## Batas dan tahap berikutnya

Ini ruang prosedural sederhana untuk validasi interaksi, belum rekonstruksi visual denah mewah. Authoring Tiled ditunda. SPRITE-001 dan OFFICE-002 masih parsial: perlu atlas transparan, anchor konsisten, arah berjalan lengkap, animasi bekerja/istirahat/interaksi, serta pengujian occlusion dan performa lebih rinci. Tujuh area lain, enam representasi tambahan, workflow, Mushola dan Hermes belum dibangun.

Tidak ada dependency baru, commit, push, perubahan Img, atau deployment. Sheet Akira sekitar 2.3 MB masih dimuat penuh; optimasi atlas dilakukan bersama produksi aset.

Buka `http://127.0.0.1:5173/#/office`. Jika server belum berjalan, jalankan `corepack pnpm dev` di root proyek.
