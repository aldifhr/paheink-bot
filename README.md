# pahe-tracker

Bot Discord sederhana untuk cari film dari `pahe.ink` dan kirim notifikasi film terbaru.

Command yang tersedia:

- `/ping`
- `/setchannel`
- `/status`
- `/search query:<judul>`
- `/latest`

Alur pakai:

1. Jalankan `node discord.js` untuk register slash command.
2. Arahkan Discord Interaction Endpoint ke `/api/interactive`.
3. Isi `.env` berdasarkan `.env.example`.
4. Set channel dengan `/setchannel`.
5. Jadwalkan FastCron ke `/api/cron` 1x sehari.
6. Buka `/` untuk dashboard test sederhana.

Bot ini mengambil data film dari endpoint WordPress JSON `pahe.ink`, lalu mem-parse detail dan link download dari konten post.

Catatan:

- Tidak ada whitelist. Semua film baru dari hasil scan terbaru akan dibroadcast ke channel yang sudah diset.
- Endpoint cron punya guard 24 jam. Kalau `/api/cron` dipanggil lagi sebelum 24 jam sejak scan terakhir, hasilnya akan di-skip.
- Dashboard test membaca data dari `/api/dashboard` dan menampilkan status bot, channel notif, state scan, dan preview film terbaru.
- Storage channel notif dan state cron sekarang memakai Upstash Redis via `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`, mengikuti pola dari `ikiru-bot`.
