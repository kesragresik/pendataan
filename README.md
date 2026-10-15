# Panduan Sistem Informasi Pendataan Tempat Ibadah Web
**Bagian Kesejahteraan Rakyat - Sekretariat Daerah Kabupaten Gresik**

Aplikasi web dashboard interaktif pendataan tempat ibadah dan lembaga keagamaan se-Kabupaten Gresik dengan **alur seleksi wilayah (Kecamatan Gateway)** dan sistem ekspor laporan per kecamatan.

Dapat langsung dibuka cukup dengan **klik ganda (double-click)** pada file [`index.html`](file:///c:/Users/W/Downloads/Compressed/web%20pendataan/index.html) tanpa memerlukan server, Node.js, ataupun instalasi tambahan (100% offline-ready).

---

## 1. Alur & Fitur Utama Sistem

### A. Landing Gateway (Pilih Kecamatan Terlebih Dahulu)
1. **Mandatory Selection:** Saat membuka web, pengguna langsung disajikan tampilan pemilihan 18 kecamatan di Kabupaten Gresik. Akses ke tabel data dikunci hingga pengguna memilih salah satu kecamatan.
2. **Pencarian Cepat Kecamatan:** Ketik nama kecamatan (misal: *Kebomas*, *Manyar*, *Sangkapura*, *Driyorejo*) pada kolom pencarian di bagian atas untuk menyaring kartu wilayah seketika.
3. **Kartu Statistik Interaktif Tiap Kecamatan:**
   - Total jumlah tempat ibadah di kecamatan tersebut.
   - Breakdown jenis tempat ibadah (🕌 Masjid, 🕋 Mushollah, ⛪ Gereja, 🛕 Pura, 📖 TPQ/Lembaga).
   - Indikator persentase kelengkapan dokumen data (*Sudah Lengkap* vs *Belum Lengkap*).
4. **Masuk ke Wilayah:** Klik kartu kecamatan untuk langsung membuka dashboard data wilayah tersebut.

### B. Dashboard Tabel Wilayah Kecamatan
1. **Header Kecamatan Aktif & Tombol "Ganti Kecamatan":**
   - Di bagian atas dashboard terdapat badge wilayah aktif (misal: `📍 KEC. KEBOMAS`).
   - Terdapat tombol **"🔄 Ganti Kecamatan"** untuk kembali ke halaman daftar 18 kecamatan kapan saja.
2. **Filter & Pencarian Khusus Wilayah:**
   - **Pencarian Bebas:** Menyaring nama tempat ibadah, desa, alamat, atau nama pengurus di kecamatan tersebut.
   - **Filter Jenis:** Hanya menampilkan opsi jenis tempat ibadah yang tersedia di wilayah kecamatan terpilih.
   - **Filter Status Kelengkapan:** Saring berdasarkan *Sudah Lengkap* atau *Belum Lengkap*.
   - **Pembersihan Spasi Otomatis (Leading Space Removal):** Secara default, sistem otomatis membersihkan semua spasi atau tab yang tidak sengaja terketik di depan kata/kalimat pada seluruh kolom tabel dan baris teks, sehingga tampilan data selalu rata kiri dan rapi.
   - **Pagination Rapi:** Pilihan 15, 25, 50, 100 baris atau tampilkan semua baris.
   - **Pengurutan Kolom (Sorting):** Klik judul kolom untuk mengurutkan (A-Z / Z-A / Angka).

### C. Aturan Ekspor Excel (.xlsx) & PDF (.pdf)
* **Prinsip Utama:** Ekspor **SELALU MENGUNDUH 1 KECAMATAN PENUH (100% DATA WILAYAH TERSEBUT)**, terlepas dari filter atau pencarian yang sedang aktif di layar tabel.
  - *Contoh Kasus:* Jika di Kecamatan Kebomas terdapat 62 data tempat ibadah, dan pengguna melakukan pencarian kata kunci tertentu sehingga di layar hanya tersisa 5 baris data, tombol **"Ekspor Excel"** maupun **"Ekspor PDF"** tetap akan mengunduh **seluruh 62 data tempat ibadah Kecamatan Kebomas**!
* **Format Nama Berkas Resmi:**
  - `Data_Pendataan_Tempat_Ibadah_KEBOMAS_10-Oktober-2026.xlsx`
  - `Data_Pendataan_Tempat_Ibadah_KEBOMAS_10-Oktober-2026.pdf`
* **Nama Tab Excel:** Tab di dalam Microsoft Excel otomatis dinamai sesuai nama kecamatan (misal `KEBOMAS`). Lebar kolom diatur otomatis agar rapi saat dicetak atau diarsip.

