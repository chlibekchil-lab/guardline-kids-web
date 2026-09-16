import { GuardlineStore } from "./store.js";

const APPS = [
  { pkg: "com.whatsapp", label: "WhatsApp" },
  { pkg: "com.instagram.android", label: "Instagram" },
  { pkg: "com.zhiliaoapp.musically", label: "TikTok" },
  { pkg: "com.google.android.youtube", label: "YouTube" },
  { pkg: "com.roblox.client", label: "Roblox" },
];

const SELECTED_KEY = "guardline_selected_device";
const CODE_KEY = "guardline_pending_code";

const els = {
  deviceList: document.getElementById("deviceList"),
  addDeviceBtn: document.getElementById("addDeviceBtn"),
  pairingView: document.getElementById("pairingView"),
  deviceView: document.getElementById("deviceView"),
  pairingCodeDisplay: document.getElementById("pairingCodeDisplay"),
  pairingStatus: document.getElementById("pairingStatus"),
  deviceTitle: document.getElementById("deviceTitle"),
  lockPill: document.getElementById("lockPill"),
  batteryVal: document.getElementById("batteryVal"),
  lastSeenVal: document.getElementById("lastSeenVal"),
  locationVal: document.getElementById("locationVal"),
  lockBtn: document.getElementById("lockBtn"),
  unlockBtn: document.getElementById("unlockBtn"),
  lockMessageInput: document.getElementById("lockMessageInput"),
  lockHours: document.getElementById("lockHours"),
  lockMinutes: document.getElementById("lockMinutes"),
  lockSeconds: document.getElementById("lockSeconds"),
  lockRemaining: document.getElementById("lockRemaining"),
  scheduleStart: document.getElementById("scheduleStart"),
  scheduleEnd: document.getElementById("scheduleEnd"),
  saveScheduleBtn: document.getElementById("saveScheduleBtn"),
  scheduleSaved: document.getElementById("scheduleSaved"),
  appList: document.getElementById("appList"),
  screenTimeChart: document.getElementById("screenTimeChart"),
};

function fmtDuration(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h) parts.push(`${h}j`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}d`);
  return parts.join(" ");
}

function fmtTime(ts) {
  if (!ts) return "-";
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 10) return "baru saja";
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.round(diff / 60)} menit lalu`;
  return `${Math.round(diff / 3600)} jam lalu`;
}

async function renderDeviceList() {
  const devices = await GuardlineStore.getAllDevices();
  const selected = localStorage.getItem(SELECTED_KEY);
  els.deviceList.innerHTML = "";
  Object.keys(devices).forEach((id) => {
    const item = document.createElement("div");
    item.className = "device-list-item" + (id === selected ? " active" : "");
    item.textContent = "📱 " + id.replace("dev-", "HP Anak — ");
    item.onclick = () => { localStorage.setItem(SELECTED_KEY, id); render(); };
    els.deviceList.appendChild(item);
  });
}

async function renderPairing() {
  const pending = localStorage.getItem(CODE_KEY);
  if (!pending) return false;
  els.pairingView.classList.remove("hidden");
  els.deviceView.classList.add("hidden");
  els.pairingCodeDisplay.textContent = pending;

  const entry = await GuardlineStore.getPairingCode(pending);
  if (entry && entry.used && entry.deviceId) {
    localStorage.setItem(SELECTED_KEY, entry.deviceId);
    localStorage.removeItem(CODE_KEY);
    render();
    return true;
  }
  return true;
}

async function renderDevice() {
  const id = localStorage.getItem(SELECTED_KEY);
  const device = id && (await GuardlineStore.getDevice(id));
  if (!device) return false;

  els.pairingView.classList.add("hidden");
  els.deviceView.classList.remove("hidden");
  els.deviceTitle.textContent = "📱 " + id.replace("dev-", "HP Anak — ");

  const locked = device.status.locked;
  els.lockPill.textContent = locked ? "Terkunci" : "Aktif";
  els.lockPill.className = "pill " + (locked ? "locked" : "unlocked");
  els.batteryVal.textContent = device.status.battery != null ? device.status.battery + "%" : "menunggu data…";
  els.lastSeenVal.textContent = fmtTime(device.status.lastSeen);
  els.locationVal.textContent = device.status.lat != null
    ? `${device.status.lat.toFixed(4)}, ${device.status.lng.toFixed(4)}`
    : "menunggu izin lokasi…";

  const lock = device.commands.lock;
  if (lock && lock.active && lock.unlockAt) {
    const remainingMs = lock.unlockAt - Date.now();
    els.lockRemaining.textContent = remainingMs > 0
      ? `Terbuka otomatis dalam ${fmtDuration(remainingMs)} — "${lock.message}"`
      : "Waktu kunci habis, sedang terbuka otomatis…";
  } else if (lock && lock.active) {
    els.lockRemaining.textContent = `Terkunci tanpa batas waktu — "${lock.message}"`;
  } else {
    els.lockRemaining.textContent = "";
  }

  const sched = device.commands.schedule;
  if (sched) {
    els.scheduleStart.value = sched.start;
    els.scheduleEnd.value = sched.end;
  }

  els.appList.innerHTML = "";
  APPS.forEach(({ pkg, label }) => {
    const row = document.createElement("div");
    row.className = "app-row";
    const blocked = !!device.commands.blockedApps[pkg];
    row.innerHTML = `
      <span>${label}</span>
      <label class="toggle">
        <input type="checkbox" ${blocked ? "checked" : ""} data-pkg="${pkg}">
        <span class="track"></span>
      </label>`;
    row.querySelector("input").addEventListener("change", (e) => {
      GuardlineStore.sendCommand(id, { blockedApps: { ...device.commands.blockedApps, [pkg]: e.target.checked } });
    });
    els.appList.appendChild(row);
  });

  els.screenTimeChart.innerHTML = "";
  const data = device.status.screenTimeMinutes || [40, 55, 30, 70, 60, 90, 50];
  const max = Math.max(...data);
  data.forEach((mins) => {
    const bar = document.createElement("div");
    bar.style.width = "20px";
    bar.style.borderRadius = "4px 4px 0 0";
    bar.style.background = "var(--amber)";
    bar.style.height = Math.max(6, (mins / max) * 90) + "px";
    els.screenTimeChart.appendChild(bar);
  });

  els.lockBtn.onclick = () => {
    const hours = parseInt(els.lockHours.value, 10) || 0;
    const minutes = parseInt(els.lockMinutes.value, 10) || 0;
    const seconds = parseInt(els.lockSeconds.value, 10) || 0;
    const durationMs = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
    GuardlineStore.sendCommand(id, {
      lock: {
        active: true,
        message: els.lockMessageInput.value.trim() || "HP dikunci oleh orang tua.",
        unlockAt: durationMs > 0 ? Date.now() + durationMs : null,
      },
    });
  };
  els.unlockBtn.onclick = () => {
    GuardlineStore.sendCommand(id, { lock: { active: false, message: "", unlockAt: null } });
  };
  els.saveScheduleBtn.onclick = () => {
    GuardlineStore.sendCommand(id, { schedule: { start: els.scheduleStart.value, end: els.scheduleEnd.value } });
    els.scheduleSaved.textContent = "Tersimpan ✓";
    setTimeout(() => (els.scheduleSaved.textContent = ""), 1800);
  };

  return true;
}

async function render() {
  await renderDeviceList();
  const showedPairing = await renderPairing();
  if (!showedPairing) await renderDevice();
}

els.addDeviceBtn.onclick = async () => {
  const code = await GuardlineStore.createPairingCode();
  localStorage.setItem(CODE_KEY, code);
  localStorage.removeItem(SELECTED_KEY);
  render();
};

GuardlineStore.onChange(render);
render();
setInterval(render, 2000); // jaga status "terakhir lapor" tetap segar
