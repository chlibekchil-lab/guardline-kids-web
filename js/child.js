import { GuardlineStore } from "./store.js";

const DEVICE_KEY = "guardline_child_device_id";
const PERMS_KEY = "guardline_child_perms";

const PERMISSIONS = [
  { id: "admin", label: "Kontrol perangkat (Device Admin)", desc: "Diperlukan agar orang tua bisa mengunci HP dari jarak jauh." },
  { id: "location", label: "Lokasi", desc: "Supaya orang tua bisa melihat lokasi HP ini." },
  { id: "usage", label: "Akses data penggunaan", desc: "Untuk menghitung waktu layar per aplikasi." },
  { id: "overlay", label: "Tampil di atas aplikasi lain", desc: "Diperlukan untuk menampilkan layar kunci kustom." },
];

const notifBar = document.getElementById("notifBar");
const onboardingStage = document.getElementById("onboardingStage");
const pairStage = document.getElementById("pairStage");
const homeStage = document.getElementById("homeStage");
const stepList = document.getElementById("stepList");
const continueToPairBtn = document.getElementById("continueToPairBtn");
const codeInput = document.getElementById("codeInput");
const pairError = document.getElementById("pairError");
const submitCodeBtn = document.getElementById("submitCodeBtn");
const lockOverlay = document.getElementById("lockOverlay");
const lockMessageEl = document.getElementById("lockMessage");
const lockCountdownEl = document.getElementById("lockCountdown");
const homeLockStatus = document.getElementById("homeLockStatus");
const homeBattery = document.getElementById("homeBattery");
const homeLocationShared = document.getElementById("homeLocationShared");

function getPerms() {
  return JSON.parse(localStorage.getItem(PERMS_KEY) || "{}");
}
function setPerm(id, granted) {
  const perms = getPerms();
  perms[id] = granted;
  localStorage.setItem(PERMS_KEY, JSON.stringify(perms));
  renderOnboarding();
}

function renderOnboarding() {
  const perms = getPerms();
  stepList.innerHTML = "";
  PERMISSIONS.forEach(({ id, label, desc }) => {
    const granted = !!perms[id];
    const li = document.createElement("li");
    li.className = granted ? "done" : "";
    li.innerHTML = `
      <div class="check">${granted ? "✓" : ""}</div>
      <div style="flex:1;">
        <strong style="font-size:0.94rem;">${label}</strong>
        <p class="muted" style="margin:0.2em 0 0;">${desc}</p>
      </div>`;
    if (!granted) {
      const btn = document.createElement("button");
      btn.className = "ghost";
      btn.textContent = "Izinkan";
      btn.onclick = () => requestPermission(id);
      li.appendChild(btn);
    }
    stepList.appendChild(li);
  });
  continueToPairBtn.disabled = !PERMISSIONS.every((p) => perms[p.id]);
}

function requestPermission(id) {
  // Meniru dialog izin sistem Android bawaan (satu per satu, jelas, tidak diam-diam).
  if (id === "location" && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      () => setPerm(id, true),
      () => setPerm(id, true) // tetap tandai selesai untuk keperluan demo walau ditolak browser
    );
    return;
  }
  setPerm(id, true);
}

continueToPairBtn.onclick = () => {
  onboardingStage.classList.add("hidden");
  pairStage.classList.remove("hidden");
};

submitCodeBtn.onclick = async () => {
  const code = codeInput.value.trim();
  if (code.length !== 6) {
    pairError.textContent = "Masukkan 6 digit kode.";
    return;
  }
  const result = await GuardlineStore.submitPairingCode(code);
  if (!result.success) {
    pairError.textContent = result.message;
    return;
  }
  localStorage.setItem(DEVICE_KEY, result.deviceId);
  pairError.textContent = "";
  enterHome();
};

function enterHome() {
  pairStage.classList.add("hidden");
  onboardingStage.classList.add("hidden");
  homeStage.classList.remove("hidden");
  notifBar.classList.remove("hidden");
  startReporting();
}

function startReporting() {
  const deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) return;

  function reportOnce() {
    const perms = getPerms();
    const battery = 20 + Math.floor(Math.random() * 75);
    const update = { battery };
    if (perms.location && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        GuardlineStore.reportStatus(deviceId, { ...update, lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => GuardlineStore.reportStatus(deviceId, update));
    } else {
      GuardlineStore.reportStatus(deviceId, update);
    }
  }

  reportOnce();
  setInterval(reportOnce, 5000);
  GuardlineStore.onChange(() => syncFromCommands(deviceId));
  syncFromCommands(deviceId);
  setInterval(() => syncFromCommands(deviceId), 1000);
}

function fmtCountdown(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

async function syncFromCommands(deviceId) {
  const device = await GuardlineStore.getDevice(deviceId);
  if (!device) return;

  const lock = device.commands.lock || { active: false };
  let locked = !!lock.active;

  // Kalau waktu kunci sudah lewat, buka otomatis dan kabari dashboard.
  if (locked && lock.unlockAt && Date.now() >= lock.unlockAt) {
    locked = false;
    GuardlineStore.sendCommand(deviceId, { lock: { active: false, message: "", unlockAt: null } });
  }

  lockOverlay.classList.toggle("hidden", !locked);
  if (locked) {
    lockMessageEl.textContent = lock.message || "Orang tuamu mengunci HP ini dari dashboard.";
    lockCountdownEl.textContent = lock.unlockAt
      ? `Terbuka otomatis dalam ${fmtCountdown(lock.unlockAt - Date.now())}`
      : "Tidak ada batas waktu — tunggu orang tua membuka.";
  }

  homeLockStatus.textContent = locked ? "Terkunci oleh orang tua" : "Aktif";
  homeBattery.textContent = device.status.battery != null ? device.status.battery + "%" : "-";
  homeLocationShared.textContent = device.status.lat != null ? "Ya, live" : "menunggu…";

  if (locked !== device.status.locked) {
    GuardlineStore.reportStatus(deviceId, { locked });
  }
}

// --- mulai ---
renderOnboarding();

// Kalau sudah pernah pairing sebelumnya di browser ini, langsung masuk Home.
(async () => {
  const existingDeviceId = localStorage.getItem(DEVICE_KEY);
  if (existingDeviceId && (await GuardlineStore.getDevice(existingDeviceId))) {
    enterHome();
  }
})();
