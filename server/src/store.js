import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "licenses.json");

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {}, events: [] }, null, 2));
}

export function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

export function writeStore(next) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2));
}

export function upsertLicense(userId, patch = {}) {
  const db = readStore();
  const prev = db.users[userId] || {
    userId,
    plan: "free",
    isActive: false,
    source: "manual",
    updatedAt: null,
  };

  db.users[userId] = {
    ...prev,
    ...patch,
    userId,
    updatedAt: new Date().toISOString(),
  };

  writeStore(db);
  return db.users[userId];
}

export function getLicense(userId) {
  const db = readStore();
  return db.users[userId] || { userId, plan: "free", isActive: false, source: "none" };
}

export function addEvent(event) {
  const db = readStore();
  db.events.unshift({ ...event, receivedAt: new Date().toISOString() });
  db.events = db.events.slice(0, 200);
  writeStore(db);
}
