"use client";

import { syncOfflineAttendance } from "@/lib/actions/attendance";
import { listPendingScans, markScanFailed, removeScan, type PendingScan } from "@/lib/offline/db";

export interface SyncSummary {
  attempted: number;
  synced: number;
  failed: number;
  remaining: number;
  errors: { student: string; message: string }[];
}

/**
 * Uploads queued offline scans. A failed record is kept in IndexedDB with the
 * server's explanation — records are never silently discarded.
 */
export async function synchronizeQueue(sessionId?: string): Promise<SyncSummary> {
  const pending = (await listPendingScans(sessionId)).filter((item) => item.status === "pending" || item.status === "failed");

  if (pending.length === 0) {
    return { attempted: 0, synced: 0, failed: 0, remaining: 0, errors: [] };
  }

  const response = await syncOfflineAttendance(
    pending.map((item) => ({
      attendance_session_id: item.attendance_session_id,
      qr_token: item.qr_token,
      client_transaction_id: item.client_transaction_id,
      local_scanned_at: item.local_scanned_at,
      device_info: item.device_info,
    }))
  );

  if (!response.ok || !response.results) {
    return {
      attempted: pending.length,
      synced: 0,
      failed: 0,
      remaining: pending.length,
      errors: [{ student: "All pending records", message: response.message ?? "The server rejected the batch." }],
    };
  }

  const byTransaction = new Map(pending.map((item) => [item.client_transaction_id, item]));
  let synced = 0;
  const errors: { student: string; message: string }[] = [];

  for (const result of response.results) {
    const transactionId = result.client_transaction_id;
    if (!transactionId) continue;
    const item = byTransaction.get(transactionId);
    if (!item) continue;

    const duplicate = result.code === "DUPLICATE";
    if (result.ok || duplicate) {
      await removeScan(transactionId);
      synced += 1;
    } else {
      await markScanFailed(transactionId, result.message ?? "Rejected by the server.");
      errors.push({ student: item.student_name, message: result.message ?? "Rejected by the server." });
    }
  }

  const remaining = await listPendingScans(sessionId);
  return {
    attempted: pending.length,
    synced,
    failed: errors.length,
    remaining: remaining.length,
    errors,
  };
}

export function pendingToCsv(rows: PendingScan[]) {
  const header = "student,matric,time_recorded,status,error";
  const lines = rows.map((row) =>
    [row.student_name, row.matric_number ?? "", row.local_scanned_at, row.status, row.error ?? ""]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...lines].join("\n");
}
