import { spawn } from "bun";
import { join } from "path";

const DB_PATH = join(import.meta.dir, "database.json");
const PY_PATH = join(import.meta.dir, "fuzzy_engine.py");

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    let data:any[] =[];
    const file = Bun.file(DB_PATH);
    if(await file.exists()){
      data=JSON.parse(await file.text() || "[]");
    }

    // ENDPOINT UNTUK MENAMBAH DATA
    if (url.pathname === "/add" && req.method === "POST") {
      try {
        // Ambil data dari body request
        const body = await req.json() as { name: string, duration: number, date: string };
        
        const file = Bun.file(DB_PATH);
        let data = [];

        // Masukkan data baru
        data.push({
          id: Date.now(),
          name: body.name,
          duration: body.duration,
          date: body.date
        });

        // 4. Simpan kembali ke file
        await Bun.write(DB_PATH, JSON.stringify(data, null, 2));
        return Response.json({ success: true });        

      } catch (err: any) {
        console.error("Error:", err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // ENDPOINT STATISTIK (Penting agar tampilan skor di web muncul)
    if (url.pathname === "/stats") {
      try {
        const totalDuration = data.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
        const totalCount = data.length;

        // Panggil Python dan tunggu hasilnya
        const py = spawn(["python3", PY_PATH, JSON.stringify({ duration: totalDuration, count: totalCount })]);
        const text = await new Response(py.stdout).text();
        
        if (!text.trim()) throw new Error("AI tidak merespons");
        
        const result = JSON.parse(text);
        let status = result.score > 60 ? "Sangat Padat" : result.score > 30 ? "Padat Sedang" : "Tidak Padat";

        return Response.json({ score: result.score, status });
      } catch (e) {
        return Response.json({ error: "Gagal memproses AI" }, { status: 500 });
      }
    }

    // --- Routing Static Files (Frontend) ---
    if (url.pathname === "/") {
      return new Response(Bun.file(join(import.meta.dir, "../frontend/index.html")));
    }
    if (url.pathname === "/style.css") {
      return new Response(Bun.file(join(import.meta.dir, "../frontend/style.css")), {
        headers: { "Content-Type": "text/css" }
      });
    }
    if (url.pathname === "/script.js") {
      return new Response(Bun.file(join(import.meta.dir, "../frontend/script.js")));
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("Server aktif di http://localhost:3000");