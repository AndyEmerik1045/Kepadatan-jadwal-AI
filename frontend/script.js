let myChart = null;

async function save() {
    const name = document.getElementById('task').value;
    const dur = document.getElementById('dur').value;
    const date = document.getElementById('date').value;

    if (!name || !dur || !date) {
        return alert("Lengkapi semua data!");
    }

    try {
        const res = await fetch('/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, duration: Number(dur), date })
        });

        const result = await res.json();

        if (!res.ok) throw new Error(result.error);

        alert("Berhasil disimpan!");
        loadTasks();
        loadStats();

    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function loadTasks() {
    const res = await fetch('/tasks');
    const data = await res.json();

    const container = document.getElementById('taskList');
    container.innerHTML = "";

    data.forEach(t => {
        const el = document.createElement("div");
        el.innerText = `${t.name} (${t.duration} jam) - ${t.date}`;
        container.appendChild(el);
    });
}

async function loadStats() {
    document.getElementById('status').innerText = "Loading...";
    
    try {
        const res = await fetch('/stats');
        const final = await res.json();

        document.getElementById('status').innerText = final.status;
        document.getElementById('score').innerText = final.score;

        const ctx = document.getElementById('densityChart').getContext('2d');

        if (myChart) myChart.destroy();

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Kepadatan'],
                datasets: [{
                    data: [final.score],
                    backgroundColor: final.score > 60 ? '#ff4d4d' : '#4a90e2'
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });

    } catch {
        document.getElementById('status').innerText = "Error";
    }
}

window.onload = () => {
    loadTasks();
    loadStats();
};