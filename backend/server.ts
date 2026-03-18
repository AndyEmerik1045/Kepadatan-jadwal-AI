import { spawn } from "bun";
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
// ⚙️ PATH
// ======================

const DB_PATH = join(import.meta.dir, "database.json");
const PY_PATH = join(import.meta.dir, "fuzzy_engine.py");

// ======================
// 📁 DATABASE LAYER
// ======================

async function readDB(): Promise<Task[]> {
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

  const newTask: Task = {
    id: Date.now(),
    ...input
  };

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

  const existing = data[index]; // ✅ TS sekarang aman

  const updated: Task = {
    id: existing.id,
    ...input
  };

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
  if (!input.name || typeof input.name !== "string") {
    return "Nama tidak valid";
  }

  if (
    typeof input.duration !== "number" ||
    input.duration < 1 ||
    input.duration > 8
  ) {
    return "Durasi harus 1 - 8 jam";
  }

  if (!input.date) {
    return "Tanggal wajib diisi";
  }

  return null;
}

// ======================
// 🤖 AI SERVICE
// ======================

async function getFuzzyStats(data: Task[]) {
  const totalDuration = data.reduce(
    (sum, item) => sum + item.duration,
    0
  );

  const totalCount = data.length;

  const py = spawn([
    "python3",
    PY_PATH,
    JSON.stringify({
      duration: totalDuration,
      count: totalCount
    })
  ]);

  const output = await new Response(py.stdout).text();
  const err = await new Response(py.stderr).text();

  if (err) throw new Error(err);
  if (!output.trim()) throw new Error("AI tidak merespons");

  const result = JSON.parse(output) as { score: number };

  const status =
    result.score > 60 ? "Sangat Padat" :
    result.score > 30 ? "Padat Sedang" :
    "Tidak Padat";

  return {
    score: result.score,
    status
  };
}

// ======================
// 🚀 SERVER
// ======================

Bun.serve({
  port: 3000,

  async fetch(req) {
    const url = new URL(req.url);

    try {
      // ======================
      // ➕ CREATE
      // ======================
      if (url.pathname === "/tasks" && req.method === "POST") {
        const body = await req.json() as TaskInput;

        const error = validateTask(body);
        if (error) {
          return Response.json({ error }, { status: 400 });
        }

        const result = await createTask(body);
        return Response.json(result);
      }

      // ======================
      // 📋 GET
      // ======================
      if (url.pathname === "/tasks" && req.method === "GET") {
        const start = url.searchParams.get("start") || undefined;
        const end = url.searchParams.get("end") || undefined;

        const result = await getTasks(start, end);
        return Response.json(result);
      }

      // ======================
      // ✏️ UPDATE
      // ======================
      if (url.pathname.startsWith("/tasks/") && req.method === "PUT") {
        const id = Number(url.pathname.split("/")[2]);
        const body = await req.json() as TaskInput;

        const error = validateTask(body);
        if (error) {
          return Response.json({ error }, { status: 400 });
        }

        const result = await updateTask(id, body);

        if (!result) {
          return Response.json({ error: "Task tidak ditemukan" }, { status: 404 });
        }

        return Response.json(result);
      }

      // ======================
      // ❌ DELETE
      // ======================
      if (url.pathname.startsWith("/tasks/") && req.method === "DELETE") {
        const id = Number(url.pathname.split("/")[2]);

        const success = await deleteTask(id);

        if (!success) {
          return Response.json({ error: "Task tidak ditemukan" }, { status: 404 });
        }

        return Response.json({ success: true });
      }

      // ======================
      // 📊 STATS
      // ======================
      if (url.pathname === "/stats") {
        const data = await readDB();
        const stats = await getFuzzyStats(data);

        return Response.json(stats);
      }

      // ======================
      // 🌐 STATIC
      // ======================
      if (url.pathname === "/") {
        return new Response(Bun.file(join(import.meta.dir, "../frontend/index.html")));
      }

      if (url.pathname === "/script.js") {
        return new Response(Bun.file(join(import.meta.dir, "../frontend/script.js")));
      }

      if (url.pathname === "/style.css") {
        return new Response(
          Bun.file(join(import.meta.dir, "../frontend/style.css")),
          { headers: { "Content-Type": "text/css" } }
        );
      }

      return new Response("Not Found", { status: 404 });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
});

console.log("🚀 Server jalan di http://localhost:3000");