# AI Affiliate Studio: rencana Free-First

Diperbarui 2026-10-28. Sumber: dokumentasi resmi ai.google.dev (pricing, rate-limits) dan developers.cloudflare.com (Workers AI). Paket gratis **website** tidak dianggap berlaku untuk **API**; hanya yang tertulis di dokumentasi API yang dihitung. Tidak ada request berbayar yang dijalankan dalam audit ini.

## Aturan

1. Setiap fitur punya jalur **manual** (tanpa AI, tanpa biaya) dan, bila ada, provider berjenjang **Free**, **Local**, **Paid**.
2. Provider **Paid** tidak pernah jadi syarat. Default anggaran berbayar = Rp0. Satu panggilan berbayar hanya jalan setelah server menampilkan estimasi biaya dan Leo menyetujuinya untuk panggilan itu.
3. Semua media disimpan di drive E: (`MEDIA_DIR`), bukan C:.
4. Kunci API hanya di `.env` server.

## Hasil audit provider

| Kebutuhan                                  | Opsi                                                                                                                     | Jenjang                       | Status berdasarkan dokumentasi                                                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Analisis produk, script, caption, hashtag  | Gemini API: `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3.1-flash-lite` | **Free** (kuota)              | Tertulis "Free of charge" di pricing API. Angka RPM/RPD tidak ada di dokumentasi; lihat di aistudio.google.com/rate-limit. Batas per **project**, reset tengah malam Pasifik. **Konten tier gratis dipakai Google untuk memperbaiki produk**: jangan kirim data rahasia. |
| Teks ke suara (Indonesia, 30 suara)        | Gemini TTS `gemini-3.8-flash-tts` / `gemini-3.8-flash-lite-tts`                                                          | **Free** (kuota)              | Tertulis ada tier gratis. Bahasa Indonesia didukung. Harga berbayar naik 2x per 1 Jan 2027. Suara tidak berlabel gender.                                                                                                                                                 |
| Gambar AI                                  | Gemini image (`gemini-nano-banana-2.1` dll.)                                                                             | **Paid saja**                 | Semua model gambar "Free tier: No". Sekitar US$0,034-0,05 per gambar.                                                                                                                                                                                                    |
| Gambar AI                                  | Cloudflare Workers AI `flux-1-schnell`                                                                                   | **Free** (10.000 neuron/hari) | Ada alokasi gratis harian; butuh akun Cloudflare dan token. Cocok untuk latar dan ilustrasi, **bukan** presenter yang konsisten (tanpa gambar referensi). Jumlah gambar per hari tergantung ukuran dan step; belum diukur.                                               |
| Video AI                                   | Gemini Omni `gemini-omni-1.1-flash`                                                                                      | **Paid saja**                 | Tidak masuk daftar gratis. Sekitar US$0,10 per detik. Veo 3.1 preview sudah dimatikan 22 Okt 2026.                                                                                                                                                                       |
| Video AI sumber terbuka (lokal)            | model difusi video                                                                                                       | Local                         | **Tidak realistis**: laptop ini Core i3, RAM 11,8 GB, GPU Intel UHD tanpa VRAM khusus. Tidak diimplementasikan.                                                                                                                                                          |
| Gambar AI lokal                            | Stable Diffusion berbasis CPU                                                                                            | Local                         | Mungkin tetapi lambat (menit per gambar), kualitas rendah, tanpa konsistensi wajah. Ditunda; tidak dijanjikan.                                                                                                                                                           |
| Edit video, subtitle, transisi, ekspor MP4 | **FFmpeg lokal** (sudah terpasang v9.0.1: libx264, QSV, aac)                                                             | **Local, 100% gratis**        | Terverifikasi di laptop ini.                                                                                                                                                                                                                                             |
| Tema suara cewek/cowok                     | pemetaan sendiri atas 30 suara Gemini                                                                                    | Free                          | Perlu uji dengar bersama Leo; tidak boleh ditebak.                                                                                                                                                                                                                       |

Belum terverifikasi dan sengaja tidak diandalkan: suara Piper berbahasa Indonesia (halaman daftar suara tidak menunjukkan satu pun), dukungan bahasa Indonesia pada MeloTTS Cloudflare, dan kemampuan gambar referensi pada model Flux Cloudflare.

## Pembagian fitur

**100% gratis dan lokal (tanpa akun apa pun):** unggah dan rapikan aset (foto produk, presenter, latar), potong ke 9:16, atur kecerahan/kontras, susun scene, zoom perlahan, transisi, subtitle dari script, musik yang Leo unggah sendiri (wajib berlisensi), ekspor MP4 9:16, ekspor caption/hashtag, penyimpanan campaign, editor manual untuk semua teks.

**Gratis dengan kuota (butuh kunci, tanpa billing):** draf script/caption/hashtag dan analisis produk (Gemini text), suara (Gemini TTS), latar AI (Cloudflare Flux, bila Leo mau membuat akun).

**Memang berbayar:** gambar AI Gemini, presenter AI yang konsisten dari foto referensi, video AI (Omni). Semuanya opsional, default mati, dan butuh persetujuan per panggilan.

## Tahapan

1. **(sedang dikerjakan)** Folder media di E:, perpustakaan aset per campaign, perapihan gambar ke 9:16 dengan FFmpeg, dan ekspor MP4 slideshow (scene, zoom, transisi, subtitle, musik).
2. Lapisan provider: jenjang Free/Local/Paid di registry, estimasi biaya dan persetujuan per panggilan berbayar, anggaran berbayar default Rp0. Draf teks Gemini gratis. Panggilan Anthropic yang sudah ada dipindah ke belakang persetujuan ini.
3. Suara: Gemini TTS gratis, uji dengar 30 suara, pemetaan cewek/cowok/gaya, voice-over masuk ke ekspor.
4. Pemilih angle dan pencampuran scene, hashtag otomatis oleh Aeri dan pemeriksaan Amy.
5. Opsional: latar AI gratis (Cloudflare), lalu jalur berbayar (gambar/video Gemini) setelah pelacakan biaya (B2) selesai.

## Batas yang jujur

- Video "orang berbicara" dari AI tidak bisa gratis di perangkat ini. Alternatifnya: foto presenter asli yang Leo unggah, dianimasikan dengan zoom/geser lewat FFmpeg, ditambah voice-over TTS. Mulut tidak bergerak.
- Foto presenter harus milik Leo atau berizin. Konten AI perlu diberi label sesuai aturan platform.
- Pengunggahan ke TikTok/Shopee tetap manual.
