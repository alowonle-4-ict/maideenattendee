import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import {
  buildSessionWorkbook,
  excelResponse,
  reportFilename,
  type RegisterRecord,
} from "@/lib/exports/attendance";
import { buildPdfReport, pdfFilename, pdfResponse } from "@/lib/exports/pdf";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx || !["lecturer", "institution_admin", "super_admin"].includes(ctx.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format");
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("attendance_sessions")
    .select(
      "id, course_id, title, class_date, institution:institutions(name), lecturer:profiles!attendance_sessions_lecturer_id_fkey(full_name), course:courses(code, title, semester:semesters(name, academic_session:academic_sessions(name)))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Session not found or not accessible" }, { status: 404 });
  }

  const [{ data: rosterRows }, { data: records }] = await Promise.all([
    supabase
      .from("course_registrations")
      .select(
        "student_id, student:profiles!course_registrations_student_id_fkey(full_name, matric_number, department:departments(name))"
      )
      .eq("course_id", session.course_id)
      .eq("status", "registered"),
    supabase
      .from("attendance_records")
      .select("attendance_session_id, student_id, status, scanned_at, sync_source")
      .eq("attendance_session_id", id),
  ]);

  const course = session.course as unknown as {
    code: string;
    title: string;
    semester: { name: string; academic_session: { name: string } | null } | null;
  } | null;
  const institution = session.institution as unknown as { name: string } | null;
  const lecturer = session.lecturer as unknown as { full_name: string } | null;

  const students = (rosterRows ?? []).map((row) => {
    const profile = row.student as unknown as {
      full_name: string;
      matric_number: string | null;
      department: { name: string } | null;
    } | null;
    return {
      id: row.student_id,
      full_name: profile?.full_name ?? "Unknown",
      matric_number: profile?.matric_number ?? null,
      department: profile?.department?.name ?? null,
    };
  });

  if (format === "pdf") {
    const recordMap = new Map(
      ((records ?? []) as RegisterRecord[]).map((record) => [record.student_id, record])
    );
    const present = students.filter((student) => recordMap.has(student.id)).length;
    const bytes = await buildPdfReport({
      meta: {
        institution: institution?.name ?? "Institution",
        reportTitle: "Individual class attendance report",
        course: course ? { code: course.code, title: course.title } : undefined,
        lecturer: lecturer?.full_name ?? null,
        academicSession: course?.semester?.academic_session?.name ?? null,
        semester: course?.semester?.name ?? null,
        className: session.title,
        classDate: formatDate(session.class_date),
      },
      columns: [
        { header: "Student name", width: 30 },
        { header: "Matric number", width: 18 },
        { header: "Department", width: 26 },
        { header: "Time scanned", width: 14 },
        { header: "Status", width: 12, align: "center" },
      ],
      rows: students.map((student) => {
        const record = recordMap.get(student.id);
        return [
          student.full_name,
          student.matric_number ?? "—",
          student.department ?? "—",
          record ? new Date(record.scanned_at).toLocaleTimeString("en-NG") : "—",
          record ? record.status.toUpperCase() : "ABSENT",
        ];
      }),
      totals: [
        { label: "Registered", value: String(students.length) },
        { label: "Present", value: String(present) },
        { label: "Absent", value: String(Math.max(students.length - present, 0)) },
      ],
      footnote:
        "Status is taken from server-confirmed records only. Offline scans appear after synchronization.",
    });
    return pdfResponse(
      bytes,
      pdfFilename([course?.code, "class", session.class_date, "attendance"])
    );
  }

  const buffer = await buildSessionWorkbook(
    {
      institution: institution?.name ?? "Institution",
      reportTitle: "Individual class attendance report",
      course: course ? { code: course.code, title: course.title } : undefined,
      lecturer: lecturer?.full_name ?? null,
      academicSession: course?.semester?.academic_session?.name ?? null,
      semester: course?.semester?.name ?? null,
      className: session.title,
      classDate: session.class_date,
    },
    students,
    (records ?? []) as RegisterRecord[]
  );

  return excelResponse(buffer, reportFilename([course?.code, "class", session.class_date, "attendance"]));
}
