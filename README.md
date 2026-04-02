# AI Schedule — Setup & Run

## Struktur Folder

```
project/
├── .devcontainer/
│   └── devcontainer.json      # Konfigurasi Otomatis (Rebuild & Skip Manual)
└── backend/
    ├── fuzzy_engine.py        # Fuzzy logic engine (Otak AI)
    └── database.json          # Database JSOn (inisialisasi: [])
├── frontend/
│   ├── index.html             # Tampilan 
│   ├── script.js              # Desain
│   └── style.css              # Logika Browser
├── server.ts                  # Backend Bun server
├── requirements.txt           # Daftar Library Python
```

## Instalasi

### 1. Install Bun
```bash
curl -fsSL https://bun.sh/install | bash
# Restart terminal atau jalankan:
source ~/.bashrc
```

### 2. Setup Python virtual environment
Dengan adanya .devcontainer/devcontainer.json, tahapan ini dapat di-skip dengan meng-clone repo sumber dan konfirm “rebuild”. devcontainer akan menginstall python library dan fuzzy library yang diperlukan
Installasi library dapat di cek dengan menjalankan: ```pip list```. 
Jika devcontainer tidak dapat menginstall, dapat menjalankan perintah dibawah ini:
```bash
python3 -m venv venv
./venv/bin/pip install numpy scikit-fuzzy netwrokx
```

Versi yang digunakan:
```
networkx     3.6.1
numpy        2.4.3
scikit-fuzzy 0.5.0
scipy        1.17.1
```

### 3. Jalankan server
```bash
bun run server.ts
```

Buka **http://localhost:3000** di browser.

---

## Endpoint API

| Method | Path          | Deskripsi              |
|--------|---------------|------------------------|
| GET    | /tasks        | Ambil semua agenda     |
| POST   | /tasks        | Tambah agenda baru     |
| PUT    | /tasks/:id    | Update agenda          |
| DELETE | /tasks/:id    | Hapus agenda           |
| GET    | /stats        | Skor fuzzy density     |

### Query param GET /tasks
- `?start=YYYY-MM-DD&end=YYYY-MM-DD` — filter rentang tanggal

### Cara Kerja AI
Aplikasi ini menggunakan Logika Fuzzy untuk menentukan seberapa "sibuk" hari Anda. Mesin AI mengambil dua input:
- Total Durasi: Jumlah jam kerja dalam sehari (0 - 12 jam).
- Jumlah Agenda: Banyaknya kegiatan yang dijadwalkan (0 - 8 kegiatan).
Outputnya adalah Skor Kepadatan ($0 \dots 100$) yang dikategorikan menjadi:
🟢 Tidak Padat (Skor < 30)
🟡 Padat Sedang (Skor 30 - 60)
🔴 Sangat Padat (Skor > 60)

### Body POST/PUT /tasks
```json
{
  "name": "Rapat Tim",
  "duration": 3,
  "date": "2025-01-15"
}
```
