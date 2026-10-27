# Spesifikasi UI/UX dan game — 204. PROJECT GROUP

Status: spesifikasi untuk fase setelah fondasi; tidak menyatakan UI kantor atau sprite telah dibuat. Referensi asli: Img/Map/ dan Img/Karakter/. Seluruh nama dan byte aset asli dipertahankan; hasil produksi baru ditempatkan di assets/runtime/, sumber turunan di assets/source/ dengan catatan asal.

## Arah visual

Kantor modern, lapang, isometrik, putih dominan, marmer terang, dinding kaca, aksen hitam/emas dan tanaman hijau. Panel aplikasi menggunakan tampilan datar minimal agar informasi mudah dibaca. Tidak memakai dashboard gelap sebagai gaya utama. Ruang negatif dan hierarki tipografi lebih penting daripada ornamen. Pixel-art chibi mempertahankan outline pixel tajam dan identitas masing-masing dari tujuh referensi; Leo tetap representasi manusia.

| Token     | Nilai rancangan | Penggunaan                                  |
| --------- | --------------- | ------------------------------------------- |
| surface   | #FFFFFF         | Panel utama                                 |
| canvas    | #F5F4F0         | Latar UI/marmer netral                      |
| ink       | #171717         | Teks utama dan aksen hitam                  |
| muted     | #525252         | Teks pendukung                              |
| border    | #D6D3CB         | Pemisah, bukan satu-satunya penanda kontrol |
| gold      | #9A6B13         | Aksen emas dan highlight terbatas           |
| gold-soft | #F8EBCB         | Latar badge/approval                        |
| green     | #246344         | Sukses dan tanaman                          |
| warning   | #805400         | Peringatan, selalu disertai ikon/teks       |
| danger    | #B42318         | Error dan aksi destruktif                   |
| focus     | #2459B8         | Fokus keyboard jelas                        |

Uji kontras aktual pada komponen. Emas dekoratif terang tidak dipakai sebagai teks kecil di atas putih. Gunakan font UI system Windows (Segoe UI, Arial, sans-serif); heading 24–32 px, section 18–20 px, body 14–16 px, metadata minimal 12 px. Font pixel hanya opsional untuk label dekoratif pendek, bukan data operasional. Grid spacing 4 px: 4/8/12/16/24/32/48. Radius 6–8 px, garis 1 px, bayangan lembut hanya untuk overlay. Angka biaya memakai tabular numerals.

## Layout dan navigasi

Desktop: sidebar 216–240 px, header 56–64 px, area utama fleksibel, detail drawer 320–400 px. Navigasi: Ringkasan, Kantor, Task, Approval, Agent, Monitoring AI, Riwayat/Log, Pengaturan. Nama produk dan status koneksi selalu dapat ditemukan. Approval memiliki badge jumlah keputusan, tidak animasi berlebihan. Office viewport terpisah dari DOM panel sehingga resize drawer tidak menghapus state simulasi.

Pada lebar 1024–1279 px sidebar dapat dipadatkan; pada 768–1023 px detail menjadi drawer overlay; di bawah 768 px panel satu kolom dan navigasi ringkas. Canvas memiliki pilihan “Lihat daftar agent” dan “Lihat task” yang setara. Scroll halaman tidak dijebak oleh pan canvas; zoom/pan tersedia lewat tombol dan keyboard selain mouse. Simpan posisi kamera secara lokal tanpa mengubah state task.

## Layar dan state UI

| Layar           | Isi dan interaksi                                                                   | Empty/loading/error/offline                                                                                           |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Office viewport | Denah, avatar, label nama, pilihan ruang, pan/zoom/reset; klik agent membuka detail | Empty menjelaskan aset belum siap; loading progres aset; error retry/fallback daftar; offline menandai snapshot stale |
| Dashboard CEO   | Ringkasan task, keputusan, biaya aktual/estimasi, sistem, instruksi baru            | Empty CTA buat instruksi; skeleton metrik; error per kartu; offline nonaktifkan kirim                                 |
| Agent detail    | Peran, status task resmi, aktivitas visual, antrean, hasil, biaya                   | Tanpa tugas “Belum ada tugas”; skeleton; error retry; tampil waktu data terakhir                                      |
| Task board      | Kolom status, filter owner/prioritas, detail dan dependensi                         | Empty sesuai filter; skeleton; validasi form inline; konflik versi meminta refresh; offline read-only                 |
| Approval inbox  | Hasil versi, diff/ringkasan, risiko/biaya, approve/revisi/tolak dengan alasan       | Empty “Tidak ada keputusan”; loading hasil; error tidak menghilangkan draf alasan; offline tombol keputusan terkunci  |
| Monitoring AI   | Provider, run, token/biaya, budget, timeout dan kegagalan                           | Belum terhubung diberi label; jangan tampil angka nol sebagai biaya diketahui; retry tanpa eksekusi ganda             |
| Riwayat dan log | Filter waktu/agent/task, korelasi event, redaksi data sensitif                      | Empty filter; pagination loading; error terisolasi; snapshot lama ditandai                                            |
| Pengaturan      | Preferensi tampilan, zona waktu/ibadah, izin/budget CEO, koneksi                    | Loading form; validasi per field; dirty-state sebelum pindah; save gagal mempertahankan masukan                       |
| Notifikasi      | Daftar terbaca/belum, jenis, waktu dan tautan target                                | Empty jelas; pembacaan gagal dapat dicoba ulang; reconnect tidak menggandakan item                                    |

Global: banner “Menghubungkan”, “Terhubung”, “Koneksi terputus”, “Menyinkronkan”, “Data terakhir diperbarui …”. Loading tidak berkedip tanpa batas; setelah timeout tampil alasan dan retry. Error tak terduga memiliki kode korelasi aman. Aksi pending menonaktifkan pengiriman ulang dan tetap menampilkan hasil eventual. Konfirmasi ditujukan untuk keputusan berdampak, bukan setiap klik navigasi. Simulasi selalu memiliki label eksplisit.

## Interaksi delapan ruang

Lobby membuka orientasi/kehadiran; Main Workspace menghubungkan workstation ke detail agent; Approval Room membuka keputusan yang menunggu; Command Room membuka dashboard/instruksi; Mushola membuka jadwal dan pengaturan pengingat; Break Lounge, Garden dan Pool Area menampilkan aktivitas idle opsional. Pool tidak dapat dilintasi sebagai jalan. Semua ruang memiliki label DOM, deskripsi dan akses melalui daftar navigasi. Tidak menambah ruangan baru tanpa CEO. Area privat/approval tidak menjadi gerbang keamanan canvas; otorisasi tetap server.

## Pipeline karakter dan animasi yang direncanakan

Sheet saat ini hanya referensi karakter. Audit setiap file terlebih dahulu: dimensi, format, background, proporsi, frame, portrait dan hak pakai. Jangan menganggap gambar front/side/back dan berjalan sudah membentuk atlas beranimasi. Simpan manifest aset yang mengaitkan nama Leo, Akira, Aeri, Amy, Kuro, Mail, Zegion dengan sumber, proses turunan dan hasil QA.

Target kerja awal: PNG RGBA transparan sRGB, canvas frame seragam 96×96 px (keputusan produksi dapat disesuaikan setelah audit satu karakter), logical footprint konsisten; anchor kaki (0,5; 0,90) sama pada semua frame. Bayangan terpisah dari sprite dan tidak masuk collision. Padding minimal 2 px, atlas tanpa filtering dan extrusion sesuai uji bleeding. Renderer nearest-neighbor, antialias off, skala integer 1×/2×/3×; hindari resize pecahan pada pixel art. Portrait empat ekspresi memakai crop dan anchor konsisten terpisah dari atlas tubuh.

| Animasi  | Frame target | FPS/durasi                | Loop dan aturan                               |
| -------- | ------------ | ------------------------- | --------------------------------------------- |
| idle     | 4            | 4 FPS, 1 detik            | Loop halus; reduced motion memakai satu frame |
| walk     | 6            | 8 FPS, 0,75 detik         | Loop; kecepatan dunia disesuaikan langkah     |
| work     | 4            | 4 FPS, 1 detik            | Loop visual, bukan bukti eksekusi             |
| sit      | 2–4          | 4 FPS, 0,5–1 detik        | Transisi lalu pose/loop ringan                |
| review   | 4            | 4 FPS, 1 detik            | Loop ketika state visual review               |
| approval | 4            | 6 FPS, sekitar 0,67 detik | Satu kali setelah event keputusan sah         |
| break    | 4            | 4 FPS, 1 detik            | Loop opsional saat idle                       |

Angka di atas target authoring, bukan deskripsi aset tersedia. Sediakan minimal empat arah gerak (depan, belakang, kiri, kanan) dengan pemetaan ke sumbu isometrik; target delapan arah hanya setelah sprite authoring disetujui. Jangan mirror detail asimetris identitas (aksesori/tulisan) tanpa QA. Manifest mencatat arah yang benar-benar tersedia; fallback pose tidak boleh mengaku animasi lengkap.

Tile acuan awal 64×32 px; tinggi sprite disetel sesudah uji meja/kursi pada satu ruang. Kaki berada di lantai, kursi punya titik duduk, workstation punya titik interaksi. Collision memakai footprint kaki kecil pada grid walkable, bukan bounding box kepala. Z-order mengikuti koordinat lantai (depth y) dan layer occlusion furnitur/dinding; karakter dapat lewat belakang meja tanpa outline terpotong salah. Koordinat dunia dan screen dipisahkan, konversi isometrik diuji. Dinding kaca memiliki collision meskipun transparan.

## Gerak dan state simulasi

Pathfinding berjalan pada nav grid turunan Tiled; furniture, pintu dan zona terlarang ditandai. Jangan menembus obyek saat tujuan sibuk: pilih titik antre, replan dengan batas percobaan, tampilkan visual idle bila buntu. Reservasi posisi menghindari tumpukan avatar. Klik workstation tidak menjalankan kerja backend. Perubahan task menghasilkan intent visual yang aman; jika scene gagal, panel task tetap berfungsi.

Pengingat ibadah menampilkan lima waktu, lokasi, metode, zona waktu dan tanggal sumber. Perubahan jadwal tidak memaksa gerak atau membatalkan pekerjaan. CEO dapat menonaktifkan suara/gerak, menunda notifikasi dan memilih koreksi menit per waktu. Jam tidak hanya diturunkan dari animasi frame.

## Accessibility dan QA desain

Seluruh aksi memiliki nama aksesibel; focus ring 2 px dengan offset, urutan fokus logis dan focus trap hanya pada dialog. Escape menutup drawer/dialog dan mengembalikan fokus. Beri live region sopan untuk koneksi/hasil keputusan, jangan membacakan setiap frame/pergerakan. Ikon memiliki label, error terikat field, data chart memiliki tabel alternatif, status disertai teks. Hormati prefers-reduced-motion dan mute; hindari flashing. Zoom browser 200% tidak memotong aksi utama.

Gate sebelum kantor penuh: screenshot satu ruang pada 1280×720 dan 1920×1080, responsif 768/390 px, keyboard saja, pembaca layar pada task/approval, kontras, transparansi sprite di latar terang, anchor semua frame, skala furnitur dan collision. Semua target dicatat sebagai belum diuji sampai implementasi terkait selesai.
