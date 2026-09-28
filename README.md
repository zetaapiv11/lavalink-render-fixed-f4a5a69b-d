# Lavalink Server Publik — "zetachei"

Lavalink v4 (image resmi `ghcr.io/lavalink-devs/lavalink:4-alpine`) + halaman
status publik (info koneksi + CPU/RAM/players live), dirancang untuk dipakai
banyak orang, deploy di Render dengan domain custom.

## Yang perlu kamu tahu SEBELUM deploy (biar tidak gagal)

Ini hasil riset sebelum bikin file-file ini — supaya kesalahan umum orang
lain saat self-host Lavalink tidak kejadian di punya kamu:

1. **Render selalu HTTPS, tidak ada mode "non-SSL" beneran.**
   Render otomatis kasih TLS gratis ke domain custom kamu, DAN otomatis
   redirect semua request HTTP polos ke HTTPS. Ini bukan bisa dimatikan.
   Akibatnya: koneksi `ws://` (non-SSL) ke domain Render **tidak akan
   pernah berhasil** — begitu client coba handshake WebSocket biasa, yang
   dia terima malah redirect HTTP, bukan upgrade ke WebSocket, jadi gagal
   connect. Jadi node ini **cuma bisa diiklankan sebagai SSL/wss saja**
   (port 443, secure: true) — dan ini sebenarnya normal, hampir semua
   Lavalink node publik yang populer sekarang juga SSL-only karena rata-rata
   dihosting di belakang platform serupa (Railway, Heroku, Cloudflare
   Tunnel, dll). Kalau kamu tetap mau ada opsi non-SSL juga, itu cuma bisa
   lewat server sendiri yang kamu pegang portnya langsung (VPS/Pterodactyl),
   bukan lewat Render — lihat bagian "Opsi non-SSL" di bawah.

2. **Password kosong itu bahaya, bukan cuma males.** Lavalink punya
   perilaku aneh: request tanpa header Authorization ditolak (401), tapi
   request dengan header Authorization yang isinya string kosong malah
   diterima (200) — jadi kalau password ke-set jadi kosong, nodenya *tetap
   kebuka* meskipun kelihatannya "aman". `start.sh` di paket ini sudah saya
   kasih pengaman: kalau `LAVALINK_SERVER_PASSWORD` kosong, container
   **menolak jalan** daripada diam-diam jadi node terbuka.

3. **Plugin YouTube wajib versi yang masih di-maintain.** Source YouTube
   bawaan Lavalink sudah lama diblokir Google. `application.yml` di sini
   sudah pakai `youtube-plugin` versi 1.18.2 (rilis terbaru saat paket ini
   dibuat) — kalau nanti gagal load YouTube lagi, cek rilis terbaru di
   https://github.com/lavalink-devs/youtube-source/releases dan update
   nomor versinya.

4. **Karena ini PUBLIK dan passwordnya gampang ditebak ("zetachei"),
   siapa pun yang tahu URL + password bisa numpang pakai node kamu** —
   itu memang tujuannya, tapi konsekuensinya kamu yang nanggung beban CPU,
   RAM, dan kalau ada limit bandwidth di plan Render kamu. Beberapa hal
   yang perlu dipertimbangkan:
   - Kalau makin banyak bot pakai, upgrade plan Render (RAM/CPU) dan
     naikkan `_JAVA_OPTIONS` (`-Xmx`) supaya sepadan.
   - Render **free plan akan sleep** setelah idle — untuk node publik
     yang dipakai orang random kapan saja, pakai plan berbayar (Starter+)
     supaya tidak sleep dan tidak bikin bot orang lain gagal connect
     tiba-tiba.
   - Tidak ada batas jumlah player/guild per pengguna di setup ini. Kalau
     nanti kewalahan, pertimbangkan ganti password berkala atau tambah
     rate-limit di `proxy/server.js`.

## Cara deploy ke Render

1. Push folder ini ke repo GitHub sendiri.
2. Di Render: **New > Blueprint**, pilih repo ini — Render otomatis baca
   `render.yaml`. (Atau manual: **New > Web Service** > environment "Docker",
   lalu isi env vars sesuai `render.yaml`.)
3. Tunggu build (~2–5 menit untuk pertama kali, karena download plugin).
4. Setelah live, tambahkan domain custom:
   - Buka service > **Settings > Custom Domains > Add Custom Domain**.
   - Render kasih target CNAME (atau A record untuk root domain) — masukkan
     itu ke DNS provider domain kamu.
   - Hapus record AAAA kalau ada (Render cuma pakai IPv4, AAAA bisa bikin
     error).
   - Tunggu Render verifikasi & terbitkan sertifikat TLS otomatis (Let's
     Encrypt), biasanya beberapa menit sampai belasan menit.

## Info koneksi buat yang mau numpang pakai node kamu

```
Host      : <domain-custom-kamu>
Port      : 443
Password  : zetachei
Secure/SSL: true
```

Ini juga ditampilkan otomatis (plus live status) di halaman:

```
https://<domain-custom-kamu>/status
```

Halaman ini publik (tidak ada login), jadi tinggal kamu sebar link-nya.
Tampilannya menampilkan CPU load, penggunaan memory, jumlah player aktif,
uptime, dan statistik frame — plus tombol salin untuk host & password.

## Menyambungkan bot zeechei kamu sendiri

```
LAVALINK_HOST=wss://<domain-custom-kamu>
LAVALINK_PORT=443
LAVALINK_PASSWORD=zetachei
LAVALINK_SECURE=true
```

## Opsi non-SSL (kalau tetap dibutuhkan)

Render tidak bisa. Kalau ada bot/klien lama yang benar-benar cuma bisa pakai
`ws://` polos, jalankan node kedua di infrastruktur kamu sendiri (VPS atau
Pterodactyl yang sudah kamu pakai untuk CheiDB), dengan port Lavalink
diekspos langsung tanpa lewat proxy TLS apa pun. Iklankan sebagai node
terpisah (host:port VPS, secure: false) — jangan dicampur dengan node Render
yang SSL-only, karena keduanya punya cara konek yang beda.

## Struktur folder

```
lavalink-render/
├── Dockerfile          # base image Lavalink + Node.js untuk status page
├── start.sh            # jalankan proxy dulu (biar port kedeteksi Render), lalu Lavalink (+ guard password kosong)
├── application.yml     # konfigurasi Lavalink + plugin (youtube-plugin, LavaSrc)
├── render.yaml         # blueprint deploy Render (password "zetachei")
└── proxy/
    ├── package.json
    ├── server.js        # reverse proxy + endpoint /api/stats (publik)
    └── public/
        └── index.html   # halaman status publik + info koneksi
```
