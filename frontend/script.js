// frontend/script.js
let myChart = null; // Variabel untuk menyimpan grafik agar bisa diupdate

async function save() {
    const name = document.getElementById('task').value;
    const dur = document.getElementById('dur').value;
    const date = document.getElementById('date').value;

    if(!name || !dur || !date) return alert("Mohon lengkapi data!");

    const data = {
        name: name,
        duration: Number(dur),
        date: date
    };

    try {
        const response = await fetch('/add', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data) 
        });

        if (response.ok) {
            alert("Data Berhasil Disimpan!");
            // Kosongkan form setelah simpan
            document.getElementById('task').value = '';
            document.getElementById('dur').value = '';
            
            // Perbarui statistik
            loadStats();
        }
    } catch (err) {
        console.error("Gagal menyimpan:", err);
    }
}

async function loadStats() {
    try {
        const res = await fetch('/stats');
        const final = await res.json();
        
        // 1. Update Teks & Skor
        document.getElementById('status').innerText = final.status;
        document.getElementById('score').innerText = final.score;

        // 2. Logika Update Grafik (Agar tidak error bertumpuk)
        const ctx = document.getElementById('densityChart').getContext('2d');
        
        if (myChart) {
            myChart.destroy(); // Hapus chart lama sebelum membuat yang baru
        }

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Kepadatan Saat Ini'], 
                datasets: [{
                    label: 'Skala 0-100',
                    data: [final.score],
                    backgroundColor: final.score > 60 ? '#ff4d4d' : '#4a90e2',
                    borderRadius: 8
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });
    } catch (err) {
        console.error("Gagal memuat stats:", err);
    }
}

// Jalankan loadStats saat halaman pertama kali dibuka
window.onload = loadStats;