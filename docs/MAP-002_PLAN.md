# Map delapan area

Persetujuan pengguna: melanjutkan map lengkap setelah pratinjau satu ruang.
Desain mengacu DESIGN.md dan denah asli Img/Map. Implementasi inline memakai workflow Superpowers dan Ponytail; tidak menambah dependency, mengubah Img, commit, atau push.

Pendekatan: map isometrik prosedural dalam Phaser dengan satu sumber data area, pintu, furnitur dan collision. Dibanding gambar tunggal, geometri ini memungkinkan jalur dan kedalaman objek; dibanding authoring atlas/Tiled baru, tetap menggunakan pipeline yang sudah teruji. Tampilan merupakan interpretasi interaktif putih/emas/kaca/hijau, bukan render fotorealistik identik.

- [x] Data delapan area, furnitur, pembatas dan pintu; tes semua area terhubung dari lobby, air/dinding/furnitur tidak bisa dilalui.
- [x] Renderer ruangan dan furnitur: reception, workstation, meja meeting, monitor command, sajadah, sofa, taman, kolam.
- [x] Kamera seluruh map/fokus area, tombol tujuan, status area dan jalur visual; pertahankan satu Akira uji.
- [x] Verifikasi tests/build/lint, browser desktop/mobile, dan jalan antararea. Laporan serta batas verifikasi cleanup tercatat di MAP-002_REPORT.md; screenshot disimpan.

Batas: tidak menambah karakter/AI/workflow/jadwal salat. Salat, approval dan monitoring masih fungsi area visual saja. Review fokus: jalan tidak menembus dinding/pool, pintu tidak tertutup props, label terbaca saat fokus, koordinat klik setelah zoom dan lifecycle tetap aman.
