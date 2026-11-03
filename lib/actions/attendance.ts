"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus, ScanResult } from "@/lib/types";
import type { ActionState } from "@/lib/actions/admin";

const sessionSchema = z.object({
  course_id: z.string().uuid("Choose a course"),
  title: z.string().trim().min(2, "Enter a class title").max(160),
  class_date: z.string().min(1, "Choose the class date"),
  opens_at: z.string().min(1, "Choose when attendance opens"),
  closes_at: z.string().min(1, "Choose when attendance closes"),
  location: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  start_now: z.string().optional(),
});

export async function createAttendanceSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuth(["lecturer", "institution_admin"]);
  if (!ctx.institutionId) return { ok: false, message: "Your account is not linked to an institution." };

  const parsed = sessionSchema.safeParse({
    course_id: formData.get("course_id"),
    title: formData.get("title"),
    class_date: formData.get("class_date"),
    opens_at: formData.get("opens_at"),
    closes_at: formData.get("closes_at"),
    location: formData.get("location") || undefined,
    notes: formData.get("notes") || undefined,
    start_now: formData.get("start_now") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const key = issue.path[0];
      if (key && !fieldErrors[String(key)]) fieldErrors[String(key)] = issue.message;
    });
    return { ok: false, message: "Check the form.", fieldErrors };
  }

  const opensAt = new Date(parsed.data.opens_at);
  const closesAt = new Date(parsed.data.closes_at);
  if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) {
    return { ok: false, message: "Check the opening and closing times." };
  }
  if (closesAt <= opensAt) {
    return { ok: false, message: "Closing time must be after the opening time." };
  }

  const supabase = await createClient();
  const startNow = parsed.data.start_now === "on";

  let lecturerId = ctx.user.id;

  if (ctx.role === "institution_admin") {
    const { data: assignment } = await supabase
      .from("course_lecturers")
      .select("lecturer_id")
      .eq("course_id", parsed.data.course_id)
      .eq("institution_id", ctx.institutionId)
      .limit(1)
      .maybeSingle();
    if (!assignment) {
      return { ok: false, message: "Assign a lecturer to this course before starting attendance." };
    }
    lecturerId = assignment.lecturer_id;
  } else {
    const { data: assignment } = await supabase
      .from("course_lecturers")
      .select("id")
      .eq("course_id", parsed.data.course_id)
      .eq("lecturer_id", ctx.user.id)
      .eq("institution_id", ctx.institutionId)
      .maybeSingle();
    if (!assignment) {
      return { ok: false, message: "You are not assigned to this course." };
    }
  }

  const { data, error } = await supabase
    .from("attendance_sessions")
    .insert({
      institution_id: ctx.institutionId,
      course_id: parsed.data.course_id,
      lecturer_id: lecturerId,
      title: parsed.data.title,
      class_date: parsed.data.class_date,
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      location: parsed.data.location ?? null,
      notes: parsed.data.notes ?? null,
      status: startNow ? "open" : "scheduled",
      opened_at: startNow ? new Date().toISOString() : null,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Could not create the attendance session." };
  }

  revalidatePath("/lecturer");
  revalidatePath("/lecturer/history");
  revalidatePath("/admin/attendance");
  return {
    ok: true,
    message: startNow ? "Attendance is now open." : "Attendance session scheduled.",
    data: { sessionId: data.id },
  };
}

export async function setSessionState(
  sessionId: string,
  action: "open" | "pause" | "resume" | "close" | "cancel"
): Promise<ActionState> {
  await requireAuth(["lecturer", "institution_admin"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("open_attendance_session", {
    p_session_id: sessionId,
    p_action: action,
  });
  if (error) return { ok: false, message: error.message };

  const messages: Record<typeof action, string> = {
    open: "Attendance is now open.",
    pause: "Attendance paused. The scanner will stop accepting scans.",
    resume: "Attendance resumed.",
    close: "Attendance closed. All recorded attendance is preserved.",
    cancel: "Attendance session cancelled.",
  };

  revalidatePath("/lecturer");
  revalidatePath("/lecturer/history");
  revalidatePath(`/lecturer/scan/${sessionId}`);
  revalidatePath("/admin/attendance");
  revalidatePath(`/admin/attendance/${sessionId}`);
  return { ok: true, message: messages[action] };
}

export async function scanAttendance(
  sessionId: string,
  token: string,
  clientTransactionId?: string,
  deviceInfo?: string
): Promise<ScanResult> {
  await requireAuth(["lecturer", "institution_admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_attendance", {
    p_session_id: sessionId,
    p_qr_token: token.trim(),
    p_client_tx_id: clientTransactionId ?? null,
    p_local_scanned_at: null,
    p_device_info: deviceInfo ?? null,
  });

  if (error) {
    return {
      ok: false,
      code: "ERROR",
      message: error.message || "The scan could not be validated.",
    };
  }

  return data as ScanResult;
}

export interface OfflineScanItem {
  attendance_session_id: string;
  qr_token: string;
  client_transaction_id: string;
  local_scanned_at: string;
  device_info?: string;
}

export interface OfflineSyncResponse {
  ok: boolean;
  message?: string;
  results?: (ScanResult & { client_transaction_id?: string })[];
}

export async function syncOfflineAttendance(items: OfflineScanItem[]): Promise<OfflineSyncResponse> {
  await requireAuth(["lecturer", "institution_admin"]);
  if (items.length === 0) return { ok: true, results: [] };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_attendance_batch", { p_items: items });
  if (error) {
    return { ok: false, message: error.message };
  }
  return data as OfflineSyncResponse;
}

export async function correctAttendance(
  recordId: string,
  status: AttendanceStatus,
  reason: string
): Promise<ActionState> {
  await requireAuth(["institution_admin", "lecturer"]);
  if (!reason.trim() || reason.trim().length < 5) {
    return { ok: false, message: "Provide a reason of at least 5 characters. Corrections are audited." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_attendance", {
    p_record_id: recordId,
    p_status: status,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/attendance");
  revalidatePath(`/admin/attendance/${recordId}`);
  revalidatePath("/lecturer/history");
  return { ok: true, message: "Attendance corrected and added to the audit trail." };
}

export async function deleteScheduledSession(sessionId: string): Promise<ActionState> {  const ctx = await requireAuth(["lecturer", "institution_admin"]);
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("attendance_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { ok: false, message: "Session not found." };
  if (!["scheduled", "cancelled"].includes(session.status)) {
    return { ok: false, message: "Only scheduled or cancelled sessions can be deleted. Close the session instead." };
  }

  const { error } = await supabase.from("attendance_sessions").delete().eq("id", sessionId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/lecturer/scan/${sessionId}`);
  revalidatePath("/lecturer/history");
  revalidatePath("/admin/attendance");
  return { ok: true, message: "Session deleted.", data: { actor: ctx.user.id } };
}

export interface OfflineBundle {
  session: {
    id: string;
    course_id: string;
    course_code: string;
    course_title: string;
    title: string;
    class_date: string;
    opens_at: string;
    closes_at: string;
    status: string;
  };
  roster: {
    student_id: string;
    full_name: string;
    matric_number: string | null;
    token: string;
  }[];
  alreadyPresent: string[];
}

/**
 * Downloads the minimum data needed to keep scanning without connectivity:
 * this session's roster and the opaque tokens for students registered in it.
 * Access is checked against the lecturer's assignment before anything is returned.
 */
export async function getOfflineSessionBundle(
  sessionId: string
): Promise<{ ok: boolean; message?: string; bundle?: OfflineBundle }> {
  const ctx = await requireAuth(["lecturer", "institution_admin"]);
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("attendance_sessions")
    .select("id, course_id, title, class_date, opens_at, closes_at, status, lecturer_id, course:courses(code, title)")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { ok: false, message: "Session not found." };

  if (ctx.role === "lecturer") {
    if (session.lecturer_id !== ctx.user.id) {
      return { ok: false, message: "You are not assigned to this session." };
    }
    const { data: assignment } = await supabase
      .from("course_lecturers")
      .select("id")
      .eq("course_id", session.course_id)
      .eq("lecturer_id", ctx.user.id)
      .maybeSingle();
    if (!assignment) return { ok: false, message: "You are not assigned to this course." };
  }

  const [{ data: registrations }, { data: records }] = await Promise.all([
    supabase
      .from("course_registrations")
      .select("student_id, student:profiles!course_registrations_student_id_fkey(full_name, matric_number)")
      .eq("course_id", session.course_id)
      .eq("status", "registered"),
    supabase.from("attendance_records").select("student_id").eq("attendance_session_id", sessionId),
  ]);

  const studentIds = (registrations ?? []).map((row) => row.student_id);
  const { data: credentials } = studentIds.length
    ? await supabase
        .from("student_qr_credentials")
        .select("student_id, token, status")
        .in("student_id", studentIds)
        .eq("status", "active")
    : { data: [] as { student_id: string; token: string; status: string }[] };

  const tokenMap = new Map((credentials ?? []).map((row) => [row.student_id, row.token]));
  const course = session.course as unknown as { code: string; title: string } | null;

  const roster = (registrations ?? [])
    .map((row) => {
      const profile = row.student as unknown as { full_name: string; matric_number: string | null } | null;
      const token = tokenMap.get(row.student_id);
      if (!token) return null;
      return {
        student_id: row.student_id,
        full_name: profile?.full_name ?? "Unknown",
        matric_number: profile?.matric_number ?? null,
        token,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    ok: true,
    bundle: {
      session: {
        id: session.id,
        course_id: session.course_id,
        course_code: course?.code ?? "",
        course_title: course?.title ?? "",
        title: session.title,
        class_date: session.class_date,
        opens_at: session.opens_at,
        closes_at: session.closes_at,
        status: session.status,
      },
      roster,
      alreadyPresent: (records ?? []).map((record) => record.student_id),
    },
  };
}

