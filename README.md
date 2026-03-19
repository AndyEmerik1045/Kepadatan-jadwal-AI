# AI Schedule — Setup & Run

## Struktur Folder

```
project/
├── server.ts               ← Backend Bun server
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
└── backend/
    ├── fuzzy_engine.py     ← Fuzzy logic engine
    └── database.json       ← Auto-generated
```

## Instalasi

### 1. Install Bun
```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Setup Python virtual environment
```bash
python3 -m venv venv
./venv/bin/pip install numpy scikit-fuzzy
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

### Body POST/PUT /tasks
```json
{
  "name": "Rapat Tim",
  "duration": 3,
  "date": "2025-01-15"
}
```