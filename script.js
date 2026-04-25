const scriptURL = "https://script.google.com/macros/s/AKfycbyKs40TqNTHZdYuEmwTMGDErVc4ZbQLQm7Qx79wA6ziSWhRX6LzBpuwCKxtUyxitEJo/exec"; 

let tasks = [];
let historyTasks = [];

window.onload = () => {
    initHistoryFilters();
    loadFromLocalStorage(); 
    fetchData(); 
    
    setInterval(saveToCloud, 20000); 
};

function loadFromLocalStorage() {
    const savedTasks = localStorage.getItem('nsp_tasks');
    const savedHistory = localStorage.getItem('nsp_history');
    if(savedTasks) tasks = JSON.parse(savedTasks);
    if(savedHistory) historyTasks = JSON.parse(savedHistory);
    render();
}

async function fetchData() {
    document.getElementById('loader').style.display = 'flex';
    try {
        const res = await fetch(scriptURL);
        const data = await res.json();
        if(data.tasks) tasks = data.tasks;
        if(data.history) historyTasks = data.history;
        render();
        renderHistory();
        console.log("Cloud synced successfully.");
    } catch (e) { 
        console.warn("Cloud offline, using local data.");
    }
    document.getElementById('loader').style.display = 'none';
}

async function saveToCloud() {
    document.getElementById('save-indicator').innerHTML = `<i class="fas fa-sync-alt animate-spin"></i> Saving...`;
    
    localStorage.setItem('nsp_tasks', JSON.stringify(tasks));
    localStorage.setItem('nsp_history', JSON.stringify(historyTasks));

    try {
        await fetch(scriptURL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: "save", tasks, history: historyTasks })
        });
        document.getElementById('save-indicator').innerHTML = `<i class="fas fa-check-circle"></i> Cloud Synced`;
        document.getElementById('last-save-time').innerText = `Saved: ${new Date().toLocaleTimeString()}`;
    } catch (e) { 
        document.getElementById('save-indicator').innerHTML = `<i class="fas fa-exclamation-triangle text-red-500"></i> Offline`;
    }
}

function calcLogic() {
    const free = parseFloat(document.getElementById('in-free').value) || 0;
    const l1 = parseFloat(document.getElementById('in-l1').value) || 0;
    const l2 = parseFloat(document.getElementById('in-l2').value) || 0;
    const rate = parseFloat(document.getElementById('in-rate').value) || 0;
    const pcs = parseFloat(document.getElementById('in-pcs').value) || 1;
    document.getElementById('out-stroke').value = (l1 - l2).toFixed(2);
    document.getElementById('out-load').value = ((free - l2) * rate * pcs).toFixed(2);
}

function addTask() {
    const partNo = document.getElementById('in-partno').value;
    const dateStr = document.getElementById('in-date').value;
    if(!partNo || !dateStr) return alert("กรุณากรอกข้อมูลให้ครบ!");

    const hr = document.getElementById('in-hr').value.padStart(2,'0');
    const min = document.getElementById('in-min').value.padStart(2,'0');
    const start = new Date(`${dateStr}T${hr}:${min}:00`).getTime();
    const total = parseInt(document.getElementById('in-total').value);
    const speed = parseInt(document.getElementById('in-speed').value);
    const finish = start + (total / speed) * 60000;

    tasks.push({
        id: Date.now(),
        machine: document.getElementById('in-machine').value,
        customer: document.getElementById('in-customer').value,
        partNo, lot: document.getElementById('in-lot').value,
        pcs: document.getElementById('in-pcs').value,
        loadMax: document.getElementById('out-load').value,
        total, start, finish,
        l1: document.getElementById('in-l1').value,
        l2: document.getElementById('in-l2').value,
        free: document.getElementById('in-free').value,
        rate: document.getElementById('in-rate').value
    });

    render();
    saveToCloud();
    resetForm();
}

setInterval(() => {
    const now = Date.now();
    let changed = false;
    tasks.forEach((t, i) => {
        if (now >= t.start) {
            const prog = Math.min(100, ((now - t.start) / (t.finish - t.start)) * 100);
            t.current_prog = prog;
            t.current_cycles = (prog / 100) * t.total;
            
            if (now >= t.finish) {
                t.current_prog = 100;
                t.current_cycles = t.total;
                historyTasks.push({...t, completedDate: now});
                tasks.splice(i, 1);
                renderHistory();
            }
            changed = true;
        }
    });
    if(changed) {
        render();
        localStorage.setItem('nsp_tasks', JSON.stringify(tasks));
    }
    document.getElementById('clock').innerText = new Date().toLocaleString('th-TH');
}, 1000);

function render() {
    const tbody = document.getElementById('running-table');
    tbody.innerHTML = tasks.map(t => {
        const prog = t.current_prog || 0;
        return `
        <tr class="hover:bg-blue-900/10">
            <td class="p-3 text-gray-500 font-mono text-[9px] uppercase">${t.machine}</td>
            <td class="p-3 font-bold text-blue-400">${t.partNo}</td>
            <td class="p-3 text-center">
                <button onclick="showDetail(${t.id})" class="w-7 h-7 rounded-full bg-blue-500/20 text-blue-500"><i class="fas fa-info text-[10px]"></i></button>
            </td>
            <td class="p-3 font-bold text-emerald-400 text-center">${t.loadMax}</td>
            <td class="p-3">
                <div class="bg-gray-800 h-1 rounded-full overflow-hidden mb-1"><div class="bg-blue-500 h-full" style="width:${prog}%"></div></div>
                <div class="flex justify-between text-[8px] text-gray-500 font-mono">
                    <span>${Math.floor(t.current_cycles || 0).toLocaleString()}</span>
                    <span class="text-blue-400 font-bold">${prog.toFixed(1)}%</span>
                </div>
            </td>
            <td class="p-3 text-gray-400 font-mono text-[8px]">${new Date(t.finish).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</td>
            <td class="p-3 text-center"><button onclick="deleteTask(${t.id})" class="text-gray-700 hover:text-red-500"><i class="fas fa-times text-xs"></i></button></td>
        </tr>`;
    }).join('');

    document.getElementById('stat-total').innerText = tasks.length + historyTasks.length;
    document.getElementById('stat-running').innerText = tasks.filter(t => Date.now() >= t.start).length;
    document.getElementById('stat-waiting').innerText = tasks.filter(t => Date.now() < t.start).length;
    document.getElementById('stat-finished').innerText = historyTasks.length;
}

function renderHistory() {
    const tbody = document.getElementById('history-table');
    tbody.innerHTML = historyTasks.slice(-10).reverse().map(t => `
        <tr class="border-b border-gray-800/50">
            <td class="p-2 text-gray-600">${new Date(t.completedDate || t.finish).toLocaleDateString('th-TH')}</td>
            <td class="p-2 font-bold text-blue-400/50">${t.partNo}</td>
            <td class="p-2 uppercase text-gray-500">${t.machine}</td>
            <td class="p-2 text-right font-mono">${t.total.toLocaleString()}</td>
        </tr>
    `).join('');
}

function resetForm() {
    ['in-partno','in-customer','in-lot','in-free','in-l1','in-l2','in-rate'].forEach(f => document.getElementById(f).value = '');
    calcLogic();
}

function initHistoryFilters() {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mSelect = document.getElementById('hist-month');
    months.forEach((m, i) => mSelect.innerHTML += `<option value="${i+1}">${m}</option>`);
    mSelect.value = new Date().getMonth() + 1;
}

function showDetail(id) {
    const t = tasks.find(x => x.id === id) || historyTasks.find(x => x.id === id);
    if(!t) return;
    document.getElementById('modalContent').innerHTML = `
        <div class="flex justify-between border-b border-gray-800 pb-2 mb-2"><span class="text-gray-500 text-[10px] uppercase">Part Number</span><span class="text-white font-bold">${t.partNo}</span></div>
        <div class="flex justify-between text-xs"><span class="text-gray-500">Machine</span><span>${t.machine}</span></div>
        <div class="flex justify-between text-xs"><span class="text-gray-500">Customer</span><span>${t.customer || '-'}</span></div>
        <div class="flex justify-between text-xs"><span class="text-gray-500">Load Max</span><span class="text-emerald-400 font-bold">${t.loadMax} N</span></div>
        <div class="flex justify-between text-xs border-t border-gray-800 mt-2 pt-2"><span class="text-gray-500">Start</span><span>${new Date(t.start).toLocaleString('th-TH')}</span></div>
        <div class="flex justify-between text-xs"><span class="text-gray-500">Estimate Finish</span><span class="text-yellow-500 font-bold">${new Date(t.finish).toLocaleString('th-TH')}</span></div>
    `;
    document.getElementById('detailModal').classList.remove('hidden');
}

function closeModal() { document.getElementById('detailModal').classList.add('hidden'); }
function deleteTask(id) { if(confirm("ลบงาน?")) { tasks = tasks.filter(t => t.id !== id); render(); saveToCloud(); } }
document.getElementById('in-date').valueAsDate = new Date();