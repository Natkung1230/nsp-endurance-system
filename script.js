import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBYeYACELSfp9tkuxYEZ4-ixZydMO50wtA",
  authDomain: "endurance-test-69a26.firebaseapp.com",
  projectId: "endurance-test-69a26",
  storageBucket: "endurance-test-69a26.firebasestorage.app",
  messagingSenderId: "949464417018",
  appId: "1:949464417018:web:69a6c5a055941e52627f43",
  measurementId: "G-DF1D45Q840"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let allData = { tasks: {}, history: {} };

onValue(ref(db), (snapshot) => {
    allData = snapshot.val() || { tasks: {}, history: {} };
    render();
    document.getElementById('loader').style.display = 'none';
});

window.calc = () => {
    const free = parseFloat(document.getElementById('in-free').value) || 0;
    const l1 = parseFloat(document.getElementById('in-l1').value) || 0;
    const l2 = parseFloat(document.getElementById('in-l2').value) || 0;
    const rate = parseFloat(document.getElementById('in-rate').value) || 0;
    const pcs = parseFloat(document.getElementById('in-pcs').value) || 1;
    document.getElementById('out-stroke').value = (l1 - l2).toFixed(2);
    document.getElementById('out-load').value = ((free - l2) * rate * pcs).toFixed(2);
};

document.getElementById('btn-add').onclick = () => {
    const partNo = document.getElementById('in-partno').value;
    const date = document.getElementById('in-date').value;
    if(!partNo || !date) return alert("กรุณากรอก Part No และ วันที่เริ่มครับ");

    const id = Date.now();
    const start = new Date(`${date}T${document.getElementById('in-hr').value.padStart(2,'0')}:${document.getElementById('in-min').value.padStart(2,'0')}:00`).getTime();
    const total = parseInt(document.getElementById('in-total').value);
    const speed = parseInt(document.getElementById('in-speed').value);
    const finish = start + (total / speed) * 60000;

    set(ref(db, 'tasks/' + id), {
        id, partNo, 
        customer: document.getElementById('in-customer').value,
        machine: document.getElementById('in-machine').value,
        lot: document.getElementById('in-lot').value,
        loadMax: document.getElementById('out-load').value,
        total, start, finish, speed,
        pcs: document.getElementById('in-pcs').value,
        l1: document.getElementById('in-l1').value,
        l2: document.getElementById('in-l2').value
    });
    resetForm();
};

window.delTask = (id, isHistory = false) => {
    if(confirm("ยืนยันการลบ?")) {
        const path = isHistory ? 'history/' : 'tasks/';
        remove(ref(db, path + id));
    }
};

window.showInfo = (id) => {
    const t = allData.tasks[id];
    if(!t) return;
    document.getElementById('modalContent').innerHTML = `
        <div class="flex justify-between border-b border-gray-800 pb-2"><span class="text-gray-500">Machine</span><span>${t.machine}</span></div>
        <div class="flex justify-between border-b border-gray-800 pb-2"><span class="text-gray-500">Customer</span><span>${t.customer || '-'}</span></div>
        <div class="flex justify-between border-b border-gray-800 pb-2"><span class="text-gray-500">Lot No</span><span>${t.lot || '-'}</span></div>
        <div class="flex justify-between border-b border-gray-800 pb-2"><span class="text-gray-500">L1/L2</span><span>${t.l1}/${t.l2} mm</span></div>
        <div class="flex justify-between pt-2"><span class="text-gray-500">Est. Finish</span><span class="text-yellow-500 font-bold">${new Date(t.finish).toLocaleString()}</span></div>
    `;
    document.getElementById('detailModal').classList.remove('hidden');
    document.getElementById('detailModal').classList.add('flex');
};

window.closeModal = () => {
    document.getElementById('detailModal').classList.add('hidden');
    document.getElementById('detailModal').classList.remove('flex');
};

function render() {
    const now = Date.now();
    const tasks = Object.values(allData.tasks || {});
    const history = Object.values(allData.history || {});

    document.getElementById('running-table').innerHTML = tasks.sort((a,b) => b.id - a.id).map(t => {
        const prog = Math.min(100, Math.max(0, ((now - t.start) / (t.finish - t.start)) * 100));
        if(prog >= 100) {
             set(ref(db, 'history/' + t.id), {...t, completedDate: now});
             remove(ref(db, 'tasks/' + t.id));
        }
        return `
        <tr class="hover:bg-blue-900/5 transition-colors">
            <td class="p-4 text-gray-500 font-mono text-[10px] uppercase">${t.machine}</td>
            <td class="p-4 font-bold text-blue-400">${t.partNo}</td>
            <td class="p-4 text-center">
                <button onclick="showInfo(${t.id})" class="w-7 h-7 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"><i class="fas fa-search text-[10px]"></i></button>
            </td>
            <td class="p-4 text-emerald-400 font-bold text-center">${t.loadMax} N</td>
            <td class="p-4">
                <div class="bg-gray-800 h-1.5 rounded-full overflow-hidden mb-1"><div class="bg-blue-500 h-full" style="width:${prog}%"></div></div>
                <div class="flex justify-between text-[9px] font-mono text-gray-500">
                    <span>${Math.floor((prog/100)*t.total).toLocaleString()} / ${t.total.toLocaleString()}</span>
                    <span class="text-blue-400">${prog.toFixed(1)}%</span>
                </div>
            </td>
            <td class="p-4 text-gray-400 font-mono text-[9px]">${new Date(t.finish).toLocaleString('th-TH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
            <td class="p-4 text-center"><button onclick="delTask(${t.id})" class="text-gray-700 hover:text-red-500"><i class="fas fa-trash-alt"></i></button></td>
        </tr>`;
    }).join('');

    document.getElementById('history-table').innerHTML = history.slice(-10).reverse().map(t => `
        <tr class="border-b border-gray-800/50">
            <td class="p-3">${new Date(t.completedDate || t.finish).toLocaleDateString('th-TH')}</td>
            <td class="p-3 font-bold text-blue-400/50">${t.partNo}</td>
            <td class="p-3 text-center uppercase">${t.machine}</td>
            <td class="p-3 text-center">${t.total.toLocaleString()}</td>
            <td class="p-3 text-center"><span class="text-[9px] bg-emerald-900/20 text-emerald-500 px-2 py-0.5 rounded border border-emerald-800 font-bold">PASS</span></td>
        </tr>
    `).join('');

    document.getElementById('stat-total').innerText = tasks.length + history.length;
    document.getElementById('stat-running').innerText = tasks.filter(t => now >= t.start).length;
    document.getElementById('stat-finished').innerText = history.length;
    document.getElementById('stat-waiting').innerText = tasks.filter(t => now < t.start).length;
    document.getElementById('stat-pass').innerText = history.length;
}

window.resetForm = () => {
    ['in-partno','in-customer','in-lot','in-free','in-l1','in-l2','in-rate'].forEach(id => document.getElementById(id).value = '');
    calc();
};

setInterval(() => {
    document.getElementById('clock').innerText = new Date().toLocaleString('th-TH');
    render();
}, 1000);

document.getElementById('in-date').valueAsDate = new Date();
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const mSelect = document.getElementById('hist-month');
months.forEach((m, i) => mSelect.innerHTML += `<option value="${i+1}">${m}</option>`);
mSelect.value = new Date().getMonth() + 1;
