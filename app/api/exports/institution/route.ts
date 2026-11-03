import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import {
  buildInstitutionWorkbook,
  excelResponse,
  reportFilename,
  type InstitutionCourseRow,
} from "@/lib/exports/attendance";
import { buildPdfReport, pdfFilename, pdfResponse } from "@/lib/exports/pdf";
import { createClient } from "@/lib/supabase/server";
import { formatPercent, percentage } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx || !ctx.institutionId || !["institution_admin", "super_admin"].includes(ctx.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const format = new URL(request.url).searchParams.get("format");
  const supabase = await createClient();
  const institutionId = ctx.institutionId;

  const [
    { data: institution },
    { data: courses },
    { data: registrations },
    { data: sessions },
    { data: assignments },
    { count: studentCount },
    { count: lecturerCount },
  ] = await Promise.all([
    supabase.from("institutions").select("name").eq("id", institutionId).maybeSingle(),
    supabase.from("courses").select("id, code, title").eq("institution_id", institutionId).order("code"),
    supabase.from("course_registrations").select("course_id").eq("institution_id", institutionId).eq("status", "registered"),
    supabase.from("attendance_sessions").select("id, course_id").eq("institution_id", institutionId).in("status", ["open", "closed"]),
    supabase
      .from("course_lecturers")
      .select("course_id, lecturer:profiles!course_lecturers_lecturer_id_fkey(full_name)")
      .eq("institution_id", institutionId),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .not("matric_number", "is", null),
    supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("role", "lecturer"),
  ]);

  const sessionIds = (sessions ?? []).map((session) => session.id);
  const { data: records } = sessionIds.length
    ? await supabase
        .from("attendance_records")
        .select("attendance_session_id, student_id")
        .in("attendance_session_id", sessionIds)
    : { data: [] as { attendance_session_id: string; student_id: string }[] };

  const sessionCourse = new Map((sessions ?? []).map((session) => [session.id, session.course_id]));
  const registeredByCourse = new Map<string, number>();
  (registrations ?? []).forEach((row) => {
    registeredByCourse.set(row.course_id, (registeredByCourse.get(row.course_id) ?? 0) + 1);
  });
  const sessionsByCourse = new Map<string, number>();
  (sessions ?? []).forEach((row) => {
    sessionsByCourse.set(row.course_id, (sessionsByCourse.get(row.course_id) ?? 0) + 1);
  });
  const presentByCourse = new Map<string, number>();
  (records ?? []).forEach((record) => {
    const courseId = sessionCourse.get(record.attendance_session_id);
    if (courseId) presentByCourse.set(courseId, (presentByCourse.get(courseId) ?? 0) + 1);
  });
  const lecturersByCourse = new Map<string, string[]>();
  (assignments ?? []).forEach((row) => {
    const name = (row.lecturer as unknown as { full_name: string } | null)?.full_name;
    if (!name) return;
    const list = lecturersByCourse.get(row.course_id) ?? [];
    list.push(name);
    lecturersByCourse.set(row.course_id, list);
  });

  const rows: InstitutionCourseRow[] = (courses ?? []).map((course) => {
    const registered = registeredByCourse.get(course.id) ?? 0;
    const held = sessionsByCourse.get(course.id) ?? 0;
    const present = presentByCourse.get(course.id) ?? 0;
    return {
      courseCode: course.code,
      courseTitle: course.title,
      lecturer: (lecturersByCourse.get(course.id) ?? []).join(", "),
      registered,
      sessionsHeld: held,
      present,
      attendanceRate: percentage(present, registered * held),
    };
  });

  if (format === "pdf") {
    const registeredTotal = (registrations ?? []).length;
    const sessionTotal = sessions?.length ?? 0;
    const average = percentage((records ?? []).length, registeredTotal * sessionTotal);
    const bytes = await buildPdfReport({
      meta: {
        institution: institution?.name ?? "Institution",
        reportTitle: "Institution-wide attendance report",
      },
      columns: [
        { header: "Course code", width: 12 },
        { header: "Course title", width: 30 },
        { header: "Lecturer", width: 22 },
        { header: "Registered", width: 10, align: "center" },
        { header: "Sessions", width: 9, align: "center" },
        { header: "Present", width: 9, align: "center" },
        { header: "Attendance", width: 12, align: "right" },
      ],
      rows: rows.map((row) => [
        row.courseCode,
        row.courseTitle,
        row.lecturer || "—",
        row.registered,
        row.sessionsHeld,
        row.present,
        formatPercent(row.attendanceRate),
      ]),
      totals: [
        { label: "Students", value: String(studentCount ?? 0) },
        { label: "Lecturers", value: String(lecturerCount ?? 0) },
        { label: "Courses", value: String(courses?.length ?? 0) },
        { label: "Classes held", value: String(sessionTotal) },
        { label: "Average attendance", value: formatPercent(average) },
      ],
      footnote:
        "Average attendance is total confirmed records divided by registered students across classes held.",
    });
    return pdfResponse(bytes, pdfFilename(["institution", "attendance-report"]));
  }

  const buffer = await buildInstitutionWorkbook(
    {
      institution: institution?.name ?? "Institution",
      reportTitle: "Institution-wide attendance report",
    },
    rows,
    {
      students: studentCount ?? 0,
      lecturers: lecturerCount ?? 0,
      courses: courses?.length ?? 0,
      sessions: sessions?.length ?? 0,
      records: records?.length ?? 0,
    }
  );

  return excelResponse(buffer, reportFilename(["institution", "attendance-report"]));
}
