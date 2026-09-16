# Guardline Kids — versi web (semua fitur aktif)

Versi ini murni HTML/CSS/JS, tanpa build step, supaya bisa langsung dicoba
di browser sebelum dibungkus jadi APK.

## Cara coba

1. Buka `index.html` di browser (bisa langsung double-click filenya, atau
   jalankan server statis lokal, mis. `python3 -m http.server` di folder ini).
2. Buka **dua tab** di browser yang sama:
   - Tab 1 → `parent.html` (dashboard orang tua)
   - Tab 2 → `child.html` (simulasi HP anak)
3. Di tab orang tua, klik **"+ Tambah perangkat"** untuk membuat kode pairing.
4. Di tab anak, selesaikan checklist izin (Device Admin, Lokasi, Usage Access,
   Overlay — disimulasikan, browser akan minta izin lokasi asli lewat dialog
   bawaan), lalu masukkan kode pairing.
5. Setelah tersambung, coba semua fitur dari dashboard: kunci HP, atur jadwal
   tidur, blokir aplikasi (WhatsApp/Instagram/TikTok/YouTube/Roblox), lihat
   baterai & lokasi live, dan grafik waktu layar. Semua langsung sinkron ke
   tab anak dalam ~2 detik.

## Fitur yang sudah aktif di versi web ini
- Pairing dengan kode 6 digit (persis alur `PairActivity.kt`)
- Kunci/buka HP dari dashboard
- Jadwal tidur (start/end)
- Blokir per-aplikasi (checklist)
- Status baterai, lokasi (geolocation asli browser), "terakhir lapor"
- Grafik waktu layar 7 hari
- Notifikasi "Guardline Kids aktif" yang selalu tampil di HP anak (tidak
  disembunyikan — sama seperti prinsip di `companion-kotlin/README.md`)

## Bagaimana ini "realtime" tanpa server
`js/store.js` meniru persis struktur data Firebase yang sudah dirancang di
`companion-kotlin/CommandListenerService.kt` (`devices/{id}/commands`,
`devices/{id}/status`, `pairingCodes/{code}`), tapi disimpan di
`localStorage` + event `storage` browser. Ini membuat dua tab di browser
yang sama bisa "saling dengar" secara live — bagus untuk demo satu perangkat,
tapi **tidak** menyambungkan dua HP fisik yang berbeda.

## Langkah selanjutnya: jadi APK sungguhan
1. **Ganti backend**: sambungkan `js/store.js` ke Firebase Realtime Database
   asli (ikuti langkah Firebase di `companion-kotlin/README.md`) — cukup ganti
   isi tiap fungsi di file itu, nama & bentuk data sudah sama sehingga
   `parent.js`/`child.js` tidak perlu diubah.
2. **Bungkus jadi APK**: opsi paling cepat dari HTML/CSS/JS murni adalah
   [Capacitor](https://capacitorjs.com) — `npx cap init`, `npx cap add android`,
   lalu isi permission asli (Device Admin, lokasi background, dsb.) lewat
   plugin native atau kode Kotlin yang sudah ada di `companion-kotlin/`.
3. Untuk fitur yang butuh akses sistem asli (lockNow() device admin, usage
   stats per app, boot receiver) — itu **tidak bisa** disimulasikan di web
   biasa; itu sebabnya skeleton Kotlin di `companion-kotlin/` tetap perlu
   diselesaikan untuk versi APK final. Anggap versi web ini sebagai prototipe
   alur & UI yang sudah teruji, siap dipetakan 1:1 ke kode Kotlin tersebut.
