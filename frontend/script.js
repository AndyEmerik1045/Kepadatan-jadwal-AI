let chart = null;
let currentEditId = null; // Menyimpan ID agenda yang sedang diedit

// ---- DOM REFS ----
let taskInput, durInput, dateInput, taskList, statusEl, scoreEl, totalEl, densityBar, chartCanvas;

window.onload = () => {
  taskInput   = document.getElementById("task");
  durInput    = document.getElementById("dur");
  dateInput   = document.getElementById("date");
  taskList    = document.getElementById("taskList");
  statusEl    = document.getElementById("status");
  scoreEl     = document.getElementById("score");
  totalEl     = document.getElementById("total");
  densityBar  = document.getElementById("density-bar");
  chartCanvas = document.getElementById("chart");

  // Set default date to today
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;

  // Header date
  const todayLabel = document.getElementById("today-label");
  if (todayLabel) {
    todayLabel.textContent = new Date().toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).toUpperCase();
  }

  // Live clock
  setInterval(() => {
    const clockEl = document.getElementById("clock");
    if (clockEl) {
      clockEl.textContent = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    }
  }, 1000);

  loadTasks();
  loadStats();
};

// ================================================
// TOAST NOTIFICATION
// ================================================

function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast" + (isError ? " error" : "");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = "toast hidden"; }, 3000);
}

// ================================================
// SAVE TASK (POST)
// ================================================

async function save() {
  const name     = taskInput.value.trim();
  const duration = Number(durInput.value);
  const date     = dateInput.value;

  if (!name || !duration || !date) {
    return showToast("⚠ Lengkapi semua field terlebih dahulu.", true);
  }

  if (duration < 1 || duration > 8) {
    return showToast("⚠ Durasi harus antara 1–8 jam.", true);
  }

  try {
    const res = await fetch("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, duration, date })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Gagal menyimpan.");

    taskInput.value = "";
    durInput.value  = "";

    showToast("✓ Agenda berhasil ditambahkan.");
    await loadTasks();
    await loadStats();
  } catch (err) {
    showToast("✗ " + err.message, true);
  }
}

// Konteks Enter: Simpan baru vs Update Edit
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const isModalOpen = !document.getElementById("editModal").classList.contains("hidden");
    if (isModalOpen) {
      submitEdit();
    } else {
      save();
    }
  }
});

// ================================================
// EDIT TASK LOGIC (PUT)
// ================================================

function openEdit(id, name, duration, date) {
  currentEditId = id;
  document.getElementById("editTask").value = name;
  document.getElementById("editDur").value = duration;
  document.getElementById("editDate").value = date;
  document.getElementById("editModal").classList.remove("hidden");
}

function closeEdit() {
  currentEditId = null;
  document.getElementById("editModal").classList.add("hidden");
}

async function submitEdit() {
  const name = document.getElementById("editTask").value.trim();
  const duration = Number(document.getElementById("editDur").value);
  const date = document.getElementById("editDate").value;

  if (!name || !duration || !date) return showToast("⚠ Data tidak boleh kosong.", true);

  try {
    const res = await fetch(`/tasks/${currentEditId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, duration, date })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Gagal update.");

    showToast("✓ Agenda diperbarui.");
    closeEdit();
    await loadTasks();
    await loadStats();
  } catch (err) {
    showToast("✗ " + err.message, true);
  }
}

// ================================================
// DELETE TASK (DELETE)
// ================================================

async function deleteTask(id) {
  if (!confirm("Hapus agenda ini?")) return;
  try {
    const res = await fetch(`/tasks/${id}`, { method: "DELETE" });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Gagal menghapus.");

    showToast("✓ Agenda dihapus.");
    await loadTasks();
    await loadStats();
  } catch (err) {
    showToast("✗ " + err.message, true);
  }
}

// ================================================
// LOAD TASK LIST (GET)
// ================================================

async function loadTasks() {
  try {
    const res  = await fetch("/tasks");
    const data = await res.json();

    taskList.innerHTML = "";

    if (!data || data.length === 0) {
      taskList.innerHTML = `<div class="task-empty">Belum ada agenda. Tambahkan yang pertama!</div>`;
      totalEl.textContent = "0";
      return;
    }

    data.sort((a, b) => b.date.localeCompare(a.date));
    totalEl.textContent = data.length;

    data.forEach((t, i) => {
      const div = document.createElement("div");
      div.className = "task-item";
      div.style.animationDelay = `${i * 0.04}s`;

      const durColor = t.duration >= 6 ? "var(--danger)" :
                       t.duration >= 4 ? "var(--warm)" : "var(--accent)";

      div.innerHTML = `
        <div class="task-dot" style="background:${durColor}"></div>
        <div class="task-name">${escapeHtml(t.name)}</div>
        <div class="task-meta">${t.duration}j</div>
        <div class="task-date">${formatDate(t.date)}</div>
        <div class="task-actions">
          <button class="task-edit" onclick="openEdit(${t.id}, '${escapeHtml(t.name)}', ${t.duration}, '${t.date}')" title="Edit">✎</button>
          <button class="task-delete" onclick="deleteTask(${t.id})" title="Hapus">✕</button>
        </div>
      `;
      taskList.appendChild(div);
    });
  } catch (err) {
    taskList.innerHTML = `<div class="task-empty">Gagal memuat agenda.</div>`;
  }
}

// ================================================
// LOAD STATS + CHART (GET STATS)
// ================================================

async function loadStats() {
  try {
    const [statsRes, tasksRes] = await Promise.all([
      fetch("/stats"),
      fetch("/tasks")
    ]);

    const stats = await statsRes.json();
    const tasks = await tasksRes.json();

    if (!statsRes.ok) throw new Error(stats.error);

    const score = stats.score ?? 0;
    scoreEl.textContent = score.toFixed(1);
    statusEl.textContent = stats.status || "—";

    statusEl.className = "stat-value";
    if (score > 60)      statusEl.classList.add("dense-high");
    else if (score > 30) statusEl.classList.add("dense-mid");
    else                 statusEl.classList.add("dense-low");

    densityBar.style.width = Math.min(score, 100) + "%";
    buildWeeklyChart(tasks || []);

  } catch (err) {
    scoreEl.textContent = "—";
    statusEl.textContent = "Error";
  }
}

// ================================================
// WEEKLY CHART LOGIC
// ================================================

function buildWeeklyChart(tasks) {
  const days = [];
  const labels = [];
  const durations = [];
  const counts = [];

  for (let i = 0; i <= 6; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    const dayName = d.toLocaleDateString("id-ID", { weekday: "short" }).toUpperCase();
    const dayNum  = d.getDate();

    days.push(key);
    labels.push(`${dayName} ${dayNum}`);

    const dayTasks = tasks.filter(t => t.date === key);
    durations.push(dayTasks.reduce((s, t) => s + t.duration, 0));
    counts.push(dayTasks.length);
  }

  if (chart) chart.destroy();

  const ctx = chartCanvas.getContext("2d");
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total Jam",
          data: durations,
          backgroundColor: durations.map(d => d >= 10 ? "#dc2626b3" : d >= 6 ? "#d97706b3" : "#16a34ab3"),
          borderColor: durations.map(d => d >= 10 ? "#dc2626" : d >= 6 ? "#d97706" : "#16a34a"),
          borderWidth: 1,
          borderRadius: 3,
          order: 2
        },
        {
          label: "Jumlah Agenda",
          data: counts,
          type: "line",
          borderColor: "#2563ebcc",
          backgroundColor: "#2563eb14",
          pointBackgroundColor: "#2563eb",
          pointRadius: 4,
          tension: 0.4,
          fill: true,
          yAxisID: "y2",
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#6b7280", font: { family: "'DM Mono'", size: 10 } } }
      },
      scales: {
        x: { ticks: { color: "#6b7280", font: { family: "'DM Mono'", size: 10 } } },
        y: { title: { display: true, text: "JAM", color: "#9ca3af", font: { size: 9 } } },
        y2: { position: "right", title: { display: true, text: "AGENDA", color: "#9ca3af", font: { size: 9 } } }
      }
    }
  });
  chartCanvas.parentElement.style.height = "220px";
}

// ================================================
// UTILS
// ================================================

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}