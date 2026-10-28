# Menjalankan di internet (HTTPS)

Server sengaja hanya mau mendengarkan `127.0.0.1`. Untuk dipakai dari luar komputer, letakkan reverse proxy di depannya yang memegang HTTPS. Server sudah siap: cookie `Secure`, header HSTS, dan batas percobaan masuk per alamat klien aktif otomatis kalau `.env` diisi seperti di bawah.

## Pengaturan `.env` di server

```
WEB_ORIGIN=https://kantor.contoh.com   # alamat yang dibuka di browser, tanpa path
TRUST_PROXY=true                        # hanya jika proxy memang di depan server
OWNER_PASSWORD=<kata sandi panjang>
```

`WEB_ORIGIN` berawalan `https:` membuat cookie sesi `Secure` dan mengirim `Strict-Transport-Security`. `TRUST_PROXY=true` membuat alamat klien diambil dari proxy; jangan nyalakan bila server bisa dijangkau langsung tanpa proxy, karena header palsu akan dipercaya.

## Contoh Caddy (sertifikat otomatis)

```
kantor.contoh.com {
	handle_path /api/* {
		reverse_proxy 127.0.0.1:3001
	}
	handle {
		root * /path/ke/apps/web/dist
		try_files {path} /index.html
		file_server
	}
}
```

`handle_path` membuang awalan `/api` sebelum diteruskan, sama seperti proxy dev Vite. Aliran peristiwa (`/api/events`) butuh respons tanpa buffer; Caddy sudah begitu secara bawaan. Di nginx tambahkan `proxy_buffering off;` pada lokasi `/api/`.

## Sebelum dibuka ke internet

- Bangun web: `corepack pnpm build`, lalu sajikan `apps/web/dist`.
- Jalankan server dengan `corepack pnpm --filter @204/server start` (di bawah pengawas proses seperti PM2 atau layanan Windows).
- Cadangkan folder `apps/server/data/` (database dan file unggahan).
- Satu kata sandi untuk satu pemilik; tidak ada pembatasan biaya AI atau akun lain. Jangan buka ke publik sebelum itu dipikirkan.
