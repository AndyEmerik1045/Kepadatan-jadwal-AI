import { spawn } from "bun";
import { mkdir } from "fs/promises";
import { join } from "path";

// ======================
// 📦 TYPES
// ======================

type Task = {
  id: number;
  name: string;
  duration: number;
  date: string; // YYYY-MM-DD
};

type TaskInput = {
  name: string;
  duration: number;
  date: string;
};

// ======================
// ⚙️ PATHS
// ======================

const DB_PATH = join(import.meta.dir, "backend", "database.json");
const PY_PATH = join(import.meta.dir, "backend", "fuzzy_engine.py");

// ======================
// 📁 DATABASE LAYER
// ======================

async function readDB(): Promise<Task[]> {
  try { await mkdir(join(import.meta.dir, "backend"), { recursive: true }); } catch {}

  const file = Bun.file(DB_PATH);
  if (!(await file.exists())) return [];

  try {
    return JSON.parse(await file.text()) as Task[];
  } catch {
    return [];
  }
}

async function writeDB(data: Task[]) {
  await Bun.write(DB_PATH, JSON.stringify(data, null, 2));
}

// ======================
// 🧠 SERVICE LAYER
// ======================

async function createTask(input: TaskInput): Promise<Task> {
  const data = await readDB();
  const newTask: Task = { id: Date.now(), ...input };
  data.push(newTask);
  await writeDB(data);
  return newTask;
}

async function getTasks(start?: string, end?: string): Promise<Task[]> {
  const data = await readDB();
  if (start && end) {
    return data.filter(t => t.date >= start && t.date <= end);
  }
  return data;
}

async function updateTask(id: number, input: TaskInput): Promise<Task | null> {
  const data = await readDB();
  const index = data.findIndex(t => t.id === id);
  if (index === -1) return null;

  const existing = data[index];
  if (!existing) return null;

  const updated: Task = { id: existing.id, ...input };
  data[index] = updated;
  await writeDB(data);
  return updated;
}

async function deleteTask(id: number): Promise<boolean> {
  const data = await readDB();
  const newData = data.filter(t => t.id !== id);
  if (newData.length === data.length) return false;
  await writeDB(newData);
  return true;
}

// ======================
// ✅ VALIDATION
// ======================

function validateTask(input: TaskInput): string | null {
  if (!input.name || typeof input.name !== "string") return "Nama tidak valid";
  if (typeof input.duration !== "number" || input.duration < 1 || input.duration > 8)
    return "Durasi harus 1 - 8 jam";
  if (!input.date) return "Tanggal wajib diisi";
  return null;
}

// ======================
// 🤖 FUZZY AI SERVICE
// ======================

async function getFuzzyStats(data: Task[]) {
  const totalDuration = data.reduce((sum, item) => sum + item.duration, 0);
  const totalCount    = data.length;

  // Handle edge case: no tasks → score 0
  if (totalCount === 0) return { score: 0, status: "Tidak Padat" };

  const py = spawn([
    join(import.meta.dir, "venv/bin/python3"),
    PY_PATH,
    JSON.stringify({ duration: totalDuration, count: totalCount })
  ]);

  const output = await new Response(py.stdout).text();
  const err    = await new Response(py.stderr).text();

  if (err)           throw new Error(err.trim());
  if (!output.trim()) throw new Error("AI tidak merespons");

  const result = JSON.parse(output) as { score: number };

  const status =
    result.score > 60 ? "Sangat Padat" :
    result.score > 30 ? "Padat Sedang" :
                        "Tidak Padat";

  return { score: result.score, status };
}

// ======================
// 🌐 CORS HELPER
// ======================

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}

// ======================
// 🚀 SERVER
// ======================

Bun.serve({
  port: 3000,

  async fetch(req) {
    const url = new URL(req.url);

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      // ── CREATE ──────────────────────────────────
      if (url.pathname === "/tasks" && req.method === "POST") {
        const body = await req.json() as TaskInput;
        const error = validateTask(body);
        if (error) return json({ error }, 400);
        const result = await createTask(body);
        return json(result);
      }

      // ── LIST ────────────────────────────────────
      if (url.pathname === "/tasks" && req.method === "GET") {
        const start = url.searchParams.get("start") || undefined;
        const end   = url.searchParams.get("end")   || undefined;
        const result = await getTasks(start, end);
        return json(result);
      }

      // ── UPDATE ──────────────────────────────────
      if (url.pathname.startsWith("/tasks/") && req.method === "PUT") {
        const id    = Number(url.pathname.split("/")[2]);
        const body  = await req.json() as TaskInput;
        const error = validateTask(body);
        if (error) return json({ error }, 400);
        const result = await updateTask(id, body);
        if (!result) return json({ error: "Task tidak ditemukan" }, 404);
        return json(result);
      }

      // ── DELETE ──────────────────────────────────
      if (url.pathname.startsWith("/tasks/") && req.method === "DELETE") {
        const id      = Number(url.pathname.split("/")[2]);
        const success = await deleteTask(id);
        if (!success) return json({ error: "Task tidak ditemukan" }, 404);
        return json({ success: true });
      }

      // ── STATS (fuzzy) ────────────────────────────
      if (url.pathname === "/stats" && req.method === "GET") {
        const data  = await readDB();
        const stats = await getFuzzyStats(data);
        return json(stats);
      }

      // ── STATIC FILES ─────────────────────────────
      const staticMap: Record<string, [string, string]> = {
        "/":          [join(import.meta.dir, "frontend/index.html"), "text/html"],
        "/script.js": [join(import.meta.dir, "frontend/script.js"),  "application/javascript"],
        "/style.css": [join(import.meta.dir, "frontend/style.css"),  "text/css"],
      };

      const staticEntry = staticMap[url.pathname];
      if (staticEntry) {
        const [filePath, contentType] = staticEntry;
        return new Response(Bun.file(filePath), {
          headers: { "Content-Type": contentType, ...corsHeaders() }
        });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders() });

    } catch (err: any) {
      console.error("[ERROR]", err.message);
      return json({ error: err.message }, 500);
    }
  }
});

console.log("🚀 Server berjalan di http://localhost:3000");