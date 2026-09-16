/**
 * Guardline Kids — lapisan data, versi Firebase Realtime Database asli.
 *
 * Struktur data persis seperti yang dirancang di
 * companion-kotlin/CommandListenerService.kt & PairActivity.kt:
 *
 *   devices/{deviceId}/commands/{lock, schedule, blockedApps}
 *   devices/{deviceId}/status/{locked, battery, lastSeen, lat, lng}
 *   pairingCodes/{code6digit}/{parentUid, createdAt, used}
 *
 * Nama fungsi & bentuk data SAMA dengan versi localStorage sebelumnya,
 * jadi parent.js / child.js tidak perlu diubah sama sekali.
 */

import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  get,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const GuardlineStore = {
  /** Membuat kode pairing baru 6 digit, dipanggil dashboard orang tua. */
  async createPairingCode(parentUid = "demo-parent") {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await set(ref(db, `pairingCodes/${code}`), {
      parentUid,
      createdAt: Date.now(),
      used: false,
    });
    return code;
  },

  /** Dipanggil dari sisi anak saat kode dimasukkan. Meniru PairActivity.kt. */
  async submitPairingCode(code) {
    const codeSnap = await get(ref(db, `pairingCodes/${code}`));
    const entry = codeSnap.val();

    if (!entry) {
      return { success: false, message: "Kode tidak ditemukan. Minta orang tua membuat kode baru." };
    }
    if (entry.used) {
      return { success: false, message: "Kode sudah dipakai. Minta kode baru dari dashboard." };
    }

    const deviceId = "dev-" + Math.random().toString(36).slice(2, 10);
    await set(ref(db, `devices/${deviceId}`), {
      parentUid: entry.parentUid,
      commands: { lock: { active: false, message: "", unlockAt: null }, schedule: null, blockedApps: {} },
      status: { locked: false, battery: null, lastSeen: Date.now(), lat: null, lng: null },
    });
    await update(ref(db, `pairingCodes/${code}`), { used: true, deviceId });

    return { success: true, message: "Berhasil terhubung ke orang tua.", deviceId };
  },

  /** Cek status satu kode pairing (dipakai dashboard orang tua untuk polling). */
  async getPairingCode(code) {
    const snap = await get(ref(db, `pairingCodes/${code}`));
    return snap.val();
  },

  async getDevice(deviceId) {
    const snap = await get(ref(db, `devices/${deviceId}`));
    return snap.val();
  },

  async getAllDevices() {
    const snap = await get(ref(db, "devices"));
    return snap.val() || {};
  },

  /** Dashboard orang tua mengirim perintah — persis payload commands/ di Kotlin. */
  async sendCommand(deviceId, partialCommand) {
    await update(ref(db, `devices/${deviceId}/commands`), partialCommand);
  },

  /** Sisi anak melapor balik status — persis reportStatus() di Kotlin. */
  async reportStatus(deviceId, partialStatus) {
    await update(ref(db, `devices/${deviceId}/status`), {
      ...partialStatus,
      lastSeen: Date.now(),
    });
  },

  /**
   * Mendaftarkan pendengar realtime. Berbeda dari versi localStorage:
   * di sini kita dengarkan seluruh node `devices/` secara live dari Firebase,
   * jadi callback akan terpanggil otomatis setiap kali ada perubahan
   * di device manapun (dari tab/HP manapun, bukan cuma tab yang sama).
   */
  onChange(callback) {
    onValue(ref(db, "devices"), () => callback());
    onValue(ref(db, "pairingCodes"), () => callback());
  },

  async resetAll() {
    await set(ref(db, "devices"), {});
    await set(ref(db, "pairingCodes"), {});
  },
};
