# CaiX: Pipeline AI (Gemini)

Paket ini berisi bagian AI dari CaiX: mengubah PDF kuliah menjadi **graf konsep** dan **soal kuis** yang tiap soalnya tertaut ke halaman sumber.

| File | Fungsi |
| --- | --- |
| `caix_gemini.py` | Alur kerja lengkap: baca PDF, panggil Gemini, periksa hasil, tulis `graph.json` dan `quiz.json` |
| `extraction_schema.json` | Bentuk jawaban Gemini untuk tugas 1 (ekstraksi konsep dan relasi) |
| `quiz_schema.json` | Bentuk jawaban Gemini untuk tugas 2 (pembuatan soal kuis) |

Prinsipnya: **Gemini hanya mengusulkan, kode yang memeriksa.** Penggabungan konsep duplikat berdasarkan makna dan penilaian skor adalah tugas backend (belum ada di paket ini).

## Alur kerja

1. **Baca PDF** per halaman dengan PyMuPDF. Tiap halaman diberi penanda `[[PAGE n]]`.
2. **Potong** teks per 8 halaman. Potongan tanpa teks (slide hasil scan) dilewati.
3. **Gemini tugas 1:** untuk tiap potongan, ekstrak konsep dan relasi sesuai `extraction_schema.json`.
4. **Periksa dan rapikan:** buang relasi ke id yang tidak ada, halaman yang tidak ada di potongan itu, konsep ganda, dan data yang cacat. Gabungkan konsep ber-id sama dari potongan berbeda (halamannya disatukan).
5. **Simpan `graph.json`.**
6. **Pilih kluster kecil** di graf: satu konsep inti beserta tetangganya (maksimal 8 konsep). Dari kluster inilah soal dan pilihan pengecoh dibuat.
7. **Gemini tugas 2:** buat soal dari tiap kluster sesuai `quiz_schema.json`.
8. **Periksa soal** (lihat bagian "Pemeriksaan otomatis") dan acak urutan opsi.
9. **Simpan `quiz.json`.**

## Penjelasan tiap file

### `extraction_schema.json`
Memaksa Gemini menjawab dalam JSON dengan dua daftar:

- `concepts` (simpul graf)
  - `id`: slug unik, misalnya `binary-tree`
  - `name`: nama konsep
  - `definition`: penjelasan 1 sampai 2 kalimat
  - `importance`: `core` (ide utama) atau `supporting` (pendukung)
  - `pages`: nomor halaman tempat konsep dijelaskan
- `relations` (garis graf)
  - `source_id` dan `target_id`: konsep asal dan tujuan
  - `type`: `prerequisite_of` (harus dipahami dulu), `part_of`, `example_of`, `contrasts_with`, atau `related_to` (pilihan terakhir)
  - `explanation`: alasan singkat
  - `page`: halaman yang mendukung

### `quiz_schema.json`
Memaksa Gemini menjawab dalam JSON berisi `questions`. Tiap soal:

- `question`, `options` (tepat 4), `correct_index` (0 sampai 3), `explanation`
- `concept_ids`: konsep yang diuji (harus ada di kluster)
- `uses_relation`: `true` hanya jika soal butuh hubungan dua konsep
- `source_file` dan `source_page`: asal jawaban, untuk fitur "tertaut ke halaman sumber"
- `difficulty`: `easy`, `medium`, atau `hard`

### `caix_gemini.py`
Berisi dua prompt dan semua langkah di atas. Fungsi utamanya:

| Fungsi | Tugas |
| --- | --- |
| `pdf_to_pages`, `chunk_pages` | Baca PDF per halaman, potong per 8 halaman |
| `_call` | Kirim prompt dan schema ke Gemini. Error 429 dan 5xx diulang otomatis (jeda 15, 30, 60 detik). Error 400, 401, 403, 404 langsung berhenti dengan pesan jelas |
| `clean_extraction`, `merge_chunks` | Periksa hasil ekstraksi dan gabungkan potongan dalam satu file |
| `combine_files` | Gabungkan beberapa PDF dalam satu graf. Id yang bentrok diberi akhiran nama file |
| `neighborhood`, `pick_seeds` | Pilih kluster konsep untuk dibuatkan soal |
| `clean_quiz` | Periksa soal dan acak opsi |
| `print_stats` | Cetak jumlah relasi per jenis dan konsep tanpa relasi |

## Cara menjalankan

Butuh Python 3.10 atau lebih baru.

```
pip install google-genai pymupdf
```

Ambil API key di aistudio.google.com. **Jangan** menaruh key di dalam kode atau mengunggahnya ke GitHub. Tiap anggota tim memakai key akun Google masing-masing, dan jatahnya terpisah.

Windows CMD:
```
set GEMINI_API_KEY=isi-key-kamu
set GEMINI_MODEL=gemini-3.8-flash
python caix_gemini.py "nama file.pdf"
```

Windows PowerShell:
```
$env:GEMINI_API_KEY="isi-key-kamu"
$env:GEMINI_MODEL="gemini-3.8-flash"
python caix_gemini.py "nama file.pdf"
```

Mac atau Linux:
```
export GEMINI_API_KEY=isi-key-kamu
export GEMINI_MODEL=gemini-3.8-flash
python caix_gemini.py "nama file.pdf"
```

Catatan:
- Nama file yang mengandung spasi **harus diberi tanda kutip**.
- Beberapa PDF sekaligus: tambahkan nama file lain di belakangnya.
- Variabel `set` hilang saat terminal ditutup, jadi isi ulang di terminal baru.
- Hasil: `graph.json` dan `quiz.json` di folder tempat perintah dijalankan.
- Jumlah soal diubah dengan variabel `CAIX_QUESTIONS` (bawaan 5). Suhu Gemini dengan `CAIX_TEMPERATURE` (bawaan 0.2).

### Memilih model
Nama model berubah-ubah. Cek daftar model yang tersedia untuk akunmu:
```
python -c "from google import genai; import os; c=genai.Client(api_key=os.environ['GEMINI_API_KEY']); [print(m.name) for m in c.models.list()]"
```
Pilih model teks bernama `flash` yang berstatus stabil, misalnya `gemini-3.8-flash`, atau `gemini-3.5-flash-lite` sebagai cadangan. Hindari model berlabel `image`, `embedding`, `tts`, `preview`, dan model lama yang sudah tidak tersedia untuk akun baru (misalnya `gemini-2.5-flash`).

## Format keluaran

`graph.json`:
```json
{
  "concepts": [
    {"id": "binary-tree", "name": "Binary Tree", "definition": "...", "importance": "core",
     "pages": [2, 9], "source_file": "lecture1.pdf"}
  ],
  "relations": [
    {"source_id": "binary-tree", "target_id": "binary-search-tree", "type": "prerequisite_of",
     "explanation": "...", "page": 3, "source_file": "lecture1.pdf"}
  ]
}
```

`quiz.json`:
```json
[
  {"question": "...", "options": ["...", "...", "...", "..."], "correct_index": 1,
   "explanation": "...", "concept_ids": ["binary-tree", "binary-search-tree"],
   "uses_relation": true, "source_file": "lecture1.pdf", "source_page": 3, "difficulty": "easy"}
]
```

## Pemeriksaan otomatis

Yang dibuang dari hasil Gemini:

- **Graf:** relasi ke id yang tidak ada, halaman yang tidak ada di potongan itu, konsep ganda, data yang cacat.
- **Soal:** opsi bukan 4 atau ada yang kembar, `correct_index` di luar 0 sampai 3, konsep atau halaman atau file sumber yang tidak ada di kluster, penjelasan yang menyebut opsi berdasarkan posisi ("option 2", "the third option"), dan jawaban benar panjang yang jauh melebihi pengecoh.
- Soal yang sama dari dua kluster hanya dipakai sekali.
- `uses_relation` otomatis `false` kalau soal hanya menguji satu konsep.

## Yang belum ada (tugas backend)

- **Menggabungkan konsep duplikat berdasarkan makna**, misalnya `mvc` dan `mvc-approach`, atau `model-class` dan `pojo-class`. Skrip ini hanya menggabungkan id yang sama persis.
- **Jalur belajar.** Bisa diturunkan dari relasi: induk dipelajari sebelum bagiannya (`part_of`), konsep umum sebelum contohnya (`example_of`), dan `prerequisite_of` langsung berurutan.
- Penyimpanan ke PostgreSQL, API, penilaian skor, dan antarmuka.
- PDF hasil scan (berupa gambar) tidak punya teks, jadi dilewati. Belum ada OCR.

## Jika ada error

| Pesan | Artinya | Yang dilakukan |
| --- | --- | --- |
| `503 UNAVAILABLE ... high demand` | Server Gemini sedang sibuk | Tunggu, jalankan ulang di jam lain, atau pakai model lain. Potongan yang gagal dilewati dan ada peringatan di akhir |
| `429 RESOURCE_EXHAUSTED ... per day` | Jatah gratis harian model itu habis | Pindah ke model lain (jatah dihitung per model) atau tunggu sampai besok |
| `404 ... no longer available` | Nama model salah atau sudah tidak tersedia | Ganti `GEMINI_MODEL` sesuai daftar model akunmu |
| `GEMINI_API_KEY is not set` | Variabel belum diisi di terminal ini | Isi lagi sesuai bagian "Cara menjalankan" |
| `no such file: '10'` | Nama file ber-spasi tanpa tanda kutip | Beri tanda kutip pada nama file |
| `Too few concepts` | PDF tidak punya teks (hasil scan) | Gunakan PDF yang teksnya bisa diseleksi |

Satu PDF sekitar 45 halaman memakai kira-kira 9 sampai 12 permintaan Gemini, sedangkan jatah gratis per model terbatas per hari. Jangan menjalankan ulang berkali-kali.
