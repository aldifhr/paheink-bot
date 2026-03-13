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
5. Cron akan hit `/api/cron` tiap 15 menit.

Bot ini mengambil data film dari endpoint WordPress JSON `pahe.ink`, lalu mem-parse detail dan link download dari konten post.

Catatan:

- Tidak ada whitelist. Semua film baru dari hasil scan terbaru akan dibroadcast ke channel yang sudah diset.
- Penyimpanan channel dan state cron saat ini berbasis file di folder `data/`. Cocok untuk lokal atau server persisten, tapi bukan penyimpanan ideal untuk serverless production.
