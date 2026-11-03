import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import {
  buildCourseRegisterWorkbook,
  buildCourseSummaryWorkbook,
  excelResponse,
  reportFilename,
  type RegisterRecord,
  type RegisterSession,
} from "@/lib/exports/attendance";
import { buildPdfReport, pdfFilename, pdfResponse } from "@/lib/exports/pdf";
import { createClient } from "@/lib/supabase/server";
import { formatPercent, percentage } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx || !["lecturer", "institution_admin", "super_admin"].includes(ctx.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const search = new URL(request.url).searchParams;
  const format = search.get("format");
  const type = search.get("type") === "summary" ? "summary" : "register";

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, code, title, semester:semesters(name, academic_session:academic_sessions(name)), institution:institutions(name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!course) {
    return NextResponse.json({ error: "Course not found or not accessible" }, { status: 404 });
  }

  const [{ data: sessions }, { data: rosterRows }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("id, class_date, title")
      .eq("course_id", id)
      .in("status", ["open", "closed"])
      .order("class_date"),
    supabase
      .from("course_registrations")
      .select(
        "student_id, student:profiles!course_registrations_student_id_fkey(full_name, matric_number, department:departments(name))"
      )
      .eq("course_id", id)
      .eq("status", "registered"),
    supabase
      .from("course_lecturers")
      .select("lecturer:profiles!course_lecturers_lecturer_id_fkey(full_name)")
      .eq("course_id", id),
  ]);

  const sessionIds = (sessions ?? []).map((session) => session.id);
  const { data: records } = sessionIds.length
    ? await supabase
        .from("attendance_records")
        .select("attendance_session_id, student_id, status, scanned_at, sync_source")
        .in("attendance_session_id", sessionIds)
    : { data: [] as RegisterRecord[] };

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

  const semester = course.semester as unknown as {
    name: string;
    academic_session: { name: string } | null;
  } | null;
  const institution = course.institution as unknown as { name: string } | null;
  const lecturers = (assignmentRows ?? [])
    .map((row) => (row.lecturer as unknown as { full_name: string } | null)?.full_name)
    .filter(Boolean)
    .join(", ");

  const meta = {
    institution: institution?.name ?? "Institution",
    reportTitle:
      type === "summary" ? "Course attendance summary" : "Complete course attendance register",
    course: { code: course.code, title: course.title },
    lecturer: lecturers || null,
    academicSession: semester?.academic_session?.name ?? null,
    semester: semester?.name ?? null,
  };

  if (format === "pdf") {
    const counts = new Map<string, number>();
    ((records ?? []) as RegisterRecord[]).forEach((record) => {
      counts.set(record.student_id, (counts.get(record.student_id) ?? 0) + 1);
    });
    const overall = percentage((records ?? []).length, students.length * sessionIds.length);
    const bytes = await buildPdfReport({
      meta: { ...meta, reportTitle: "Course attendance summary" },
      columns: [
        { header: "Student name", width: 28 },
        { header: "Matric number", width: 17 },
        { header: "Department", width: 22 },
        { header: "Classes held", width: 11, align: "center" },
        { header: "Present", width: 9, align: "center" },
        { header: "Absent", width: 9, align: "center" },
        { header: "Attendance", width: 12, align: "right" },
      ],
      rows: students.map((student) => {
        const present = counts.get(student.id) ?? 0;
        return [
          student.full_name,
          student.matric_number ?? "—",
          student.department ?? "—",
          sessionIds.length,
          present,
          Math.max(sessionIds.length - present, 0),
          formatPercent(percentage(present, sessionIds.length)),
        ];
      }),
      totals: [
        { label: "Registered students", value: String(students.length) },
        { label: "Classes held", value: String(sessionIds.length) },
        { label: "Average attendance", value: formatPercent(overall) },
      ],
      footnote:
        "Attendance counts every server-confirmed record for this course. Percentage is per student across classes held.",
    });
    return pdfResponse(bytes, pdfFilename([course.code, "attendance-summary"]));
  }

  const buffer =
    type === "summary"
      ? await buildCourseSummaryWorkbook(meta, students, sessionIds.length, (records ?? []) as RegisterRecord[])
      : await buildCourseRegisterWorkbook(
          meta,
          (sessions ?? []) as RegisterSession[],
          students,
          (records ?? []) as RegisterRecord[]
        );

  return excelResponse(buffer, reportFilename([course.code, type, "attendance"]));
}
