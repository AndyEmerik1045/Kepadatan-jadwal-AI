import { spawn } from "bun";
import { join } from "path"; 

const DB_FILE = join(import.meta.dir, "backend", "database.json");
const PY_FILE = join(import.meta.dir, "backend", "fuzzy_engine.py");

async function askAI(duration: number, count: number) {
  const py = spawn(["python3", PY_FILE, JSON.stringify({ duration, count })]);

  // BACA SEKALI SAJA sebagai text
  const text = await new Response(py.stdout).text();
  
  if (!text.trim()) {
    throw new Error("Python tidak memberikan output atau terjadi error di skrip");
  }

  // Parse JSON dari variabel 'text' yang sudah kita simpan
  const output = JSON.parse(text) as { score: number };
  return output.score;
}

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Muat database
    let db: any[] = [];
    const dbFile = Bun.file(DB_FILE);
    if (await dbFile.exists()) {
       db = JSON.parse(await dbFile.text() || "[]");
    }

    // 1. Endpoint Simpan Data
    if (url.pathname === "/add" && req.method === "POST") {
      const body = await req.json() as Record<string, any>;
      db.push({ ...body, id: Date.now() });
      await Bun.write(DB_FILE, JSON.stringify(db, null, 2));
      return Response.json({ success: true });
    }

    // 2. Endpoint Statistik (Fuzzy Logic)
    if (url.pathname === "/stats") {
      // Menghitung total durasi dan jumlah task dari database asli
      const totalDuration = db.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
      const totalCount = db.length;
      
      try {
        const score = await askAI(totalDuration, totalCount);
        let status = score > 60 ? "Sangat Padat" : score > 30 ? "Padat Sedang" : "Tidak Padat";
        return Response.json({ score, status });
      } catch (err) {
        return Response.json({ error: "Gagal memproses AI" }, { status: 500 });
      }
    }

    // 3. Routing File Statis (WAJIB agar CSS dan JS terbaca)
    if (url.pathname === "/") {
      return new Response(Bun.file(join(import.meta.dir, "frontend", "index.html")));
    }
    if (url.pathname === "/style.css") {
      return new Response(Bun.file(join(import.meta.dir, "frontend", "style.css")), {
        headers: { "Content-Type": "text/css" }
      });
    }
    if (url.pathname === "/script.js") {
      return new Response(Bun.file(join(import.meta.dir, "frontend", "script.js")));
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log("Server aktif di http://localhost:3000");