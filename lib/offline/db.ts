import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface CachedRosterStudent {
  student_id: string;
  full_name: string;
  matric_number: string | null;
  token: string;
}

export interface CachedSession {
  id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  title: string;
  class_date: string;
  opens_at: string;
  closes_at: string;
  status: string;
  roster: CachedRosterStudent[];
  cached_at: string;
}

export type PendingStatus = "pending" | "failed" | "synced";

export interface PendingScan {
  client_transaction_id: string;
  attendance_session_id: string;
  qr_token: string;
  student_id: string;
  student_name: string;
  matric_number: string | null;
  local_scanned_at: string;
  device_info: string;
  status: PendingStatus;
  error?: string;
  created_at: string;
}

interface OfflineSchema extends DBSchema {
  sessions: { key: string; value: CachedSession };
  queue: {
    key: string;
    value: PendingScan;
    indexes: { "by-session": string; "by-status": string };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineSchema>> | null = null;

function getDb() {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<OfflineSchema>("maideenattendee", 2, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore("sessions", { keyPath: "id" });
          const queue = db.createObjectStore("queue", { keyPath: "client_transaction_id" });
          queue.createIndex("by-session", "attendance_session_id");
        }
        if (oldVersion < 2) {
          const store = transaction.objectStore("queue");
          if (!store.indexNames.contains("by-status")) {
            store.createIndex("by-status", "status");
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function cacheSession(session: CachedSession) {
  const db = await getDb();
  if (!db) return false;
  await db.put("sessions", { ...session, cached_at: new Date().toISOString() });
  return true;
}

export async function getCachedSession(id: string) {
  const db = await getDb();
  if (!db) return null;
  return (await db.get("sessions", id)) ?? null;
}

export async function listCachedSessions() {
  const db = await getDb();
  if (!db) return [];
  return db.getAll("sessions");
}

export async function removeCachedSession(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete("sessions", id);
}

export async function enqueueScan(scan: PendingScan) {
  const db = await getDb();
  if (!db) return false;
  await db.put("queue", scan);
  return true;
}

export async function listPendingScans(sessionId?: string) {
  const db = await getDb();
  if (!db) return [];
  const all = sessionId
    ? await db.getAllFromIndex("queue", "by-session", sessionId)
    : await db.getAll("queue");
  return (all as PendingScan[])
    .filter((item) => item.status !== "synced")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function countPending(sessionId?: string) {
  return (await listPendingScans(sessionId)).length;
}

export async function markScanFailed(clientTransactionId: string, error: string) {
  const db = await getDb();
  if (!db) return;
  const item = await db.get("queue", clientTransactionId);
  if (!item) return;
  await db.put("queue", { ...item, status: "failed", error });
}

export async function removeScan(clientTransactionId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete("queue", clientTransactionId);
}
