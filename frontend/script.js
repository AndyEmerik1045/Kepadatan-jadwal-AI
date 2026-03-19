// ================================================
// AI SCHEDULE — script.js
// ================================================

let chart = null;

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
// SAVE TASK
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

// Enter key support
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") save();
});

// ================================================
// DELETE TASK
// ================================================

async function deleteTask(id) {
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
// LOAD TASK LIST
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

    // Sort by date descending
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
        <button class="task-delete" onclick="deleteTask(${t.id})" title="Hapus">✕</button>
      `;
      taskList.appendChild(div);
    });

  } catch (err) {
    taskList.innerHTML = `<div class="task-empty">Gagal memuat agenda.</div>`;
  }
}

// ================================================
// LOAD STATS + CHART
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

    // Update score
    const score = stats.score ?? 0;
    scoreEl.textContent = score.toFixed(1);
    statusEl.textContent = stats.status || "—";

    // Color coding
    statusEl.className = "stat-value";
    if (score > 60)      statusEl.classList.add("dense-high"); //merah
    else if (score > 30) statusEl.classList.add("dense-mid"); //kuning
    else                 statusEl.classList.add("dense-low"); //hijau

    // Density bar
    densityBar.style.width = Math.min(score, 100) + "%";

    // Build weekly chart
    buildWeeklyChart(tasks || []);

  } catch (err) {
    scoreEl.textContent = "—";
    statusEl.textContent = "Error";
  }
}

// ================================================
// WEEKLY CHART
// ================================================

function buildWeeklyChart(tasks) {
  // Last 7 days
  const days   = [];
  const labels = [];
  const durations = [];
  const counts    = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const dayName = d.toLocaleDateString("id-ID", { weekday: "short" }).toUpperCase();

    days.push(key);
    labels.push(dayName);

    const dayTasks = tasks.filter(t => t.date === key);
    durations.push(dayTasks.reduce((s, t) => s + t.duration, 0));
    counts.push(dayTasks.length);
  }

  if (chart) chart.destroy();

  const ctx = chartCanvas.getContext("2d");

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, "rgba(200,255,0,0.35)");
  grad.addColorStop(1, "rgba(200,255,0,0.02)");

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total Jam",
          data: durations,
          backgroundColor: durations.map(d =>
            d >= 10 ? "rgba(255,69,96,0.75)" :
            d >= 6  ? "rgba(255,179,71,0.75)" :
            "rgba(200,255,0,0.75)"
          ),
          borderColor: durations.map(d =>
            d >= 10 ? "#ff4560" :
            d >= 6  ? "#ffb347" :
            "#c8ff00"
          ),
          borderWidth: 1,
          borderRadius: 3,
          order: 2
        },
        {
          label: "Jumlah Agenda",
          data: counts,
          type: "line",
          borderColor: "rgba(71,179,255,0.8)",
          backgroundColor: "rgba(71,179,255,0.1)",
          pointBackgroundColor: "#47b3ff",
          pointRadius: 4,
          borderWidth: 2,
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
      animation: { duration: 600, easing: "easeOutQuart" },
      plugins: {
        legend: {
          labels: {
            color: "#6b6b80",
            font: { family: "'DM Mono', monospace", size: 10 },
            boxWidth: 10,
            boxHeight: 10
          }
        },
        tooltip: {
          backgroundColor: "#1a1a25",
          borderColor: "rgba(255,255,255,0.07)",
          borderWidth: 1,
          titleColor: "#e8e8f0",
          bodyColor: "#6b6b80",
          titleFont: { family: "'Syne', sans-serif", size: 11, weight: "700" },
          bodyFont: { family: "'DM Mono', monospace", size: 10 },
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label === "Total Jam") return ` ${ctx.raw} jam kerja`;
              return ` ${ctx.raw} agenda`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#6b6b80",
            font: { family: "'DM Mono', monospace", size: 10 }
          },
          border: { color: "rgba(255,255,255,0.07)" }
        },
        y: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#6b6b80",
            font: { family: "'DM Mono', monospace", size: 10 },
            stepSize: 2
          },
          border: { color: "rgba(255,255,255,0.07)" },
          title: {
            display: true,
            text: "JAM",
            color: "#3a3a50",
            font: { family: "'DM Mono', monospace", size: 9 }
          }
        },
        y2: {
          position: "right",
          grid: { display: false },
          ticks: {
            color: "#3a4a60",
            font: { family: "'DM Mono', monospace", size: 10 },
            stepSize: 1
          },
          border: { color: "rgba(255,255,255,0.04)" },
          title: {
            display: true,
            text: "AGENDA",
            color: "#3a3a50",
            font: { family: "'DM Mono', monospace", size: 9 }
          }
        }
      }
    }
  });

  // Fix canvas height
  chartCanvas.parentElement.style.height = "220px";
}

// ================================================
// UTILS
// ================================================

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}