import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";

import { LiveRefresh } from "@/components/attendance/live-refresh";
import { SessionControls } from "@/components/attendance/session-controls";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScannerView } from "@/components/scanner/scanner-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth(["lecturer"]);
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("attendance_sessions")
    .select(
      "id, course_id, lecturer_id, title, class_date, opens_at, closes_at, status, course:courses(code, title)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!session || session.lecturer_id !== ctx.user.id) notFound();

  const { data: assignment } = await supabase
    .from("course_lecturers")
    .select("id")
    .eq("course_id", session.course_id)
    .eq("lecturer_id", ctx.user.id)
    .maybeSingle();

  if (!assignment) notFound();

  const [{ data: registrations }, { data: records }, { data: settings }] = await Promise.all([
    supabase
      .from("course_registrations")
      .select("student_id, student:profiles!course_registrations_student_id_fkey(full_name, matric_number)")
      .eq("course_id", session.course_id)
      .eq("status", "registered"),
    supabase
      .from("attendance_records")
      .select("student_id, status, scanned_at, sync_source")
      .eq("attendance_session_id", id),
    supabase.from("institution_settings").select("allow_manual_qr").eq("institution_id", ctx.institutionId!).maybeSingle(),
  ]);

  const studentIds = (registrations ?? []).map((row) => row.student_id);
  const { data: credentials } = studentIds.length
    ? await supabase
        .from("student_qr_credentials")
        .select("student_id, token")
        .in("student_id", studentIds)
        .eq("status", "active")
    : { data: [] as { student_id: string; token: string }[] };

  const tokenMap = new Map((credentials ?? []).map((row) => [row.student_id, row.token]));
  const course = session.course as unknown as { code: string; title: string } | null;

  const students = (registrations ?? []).map((row) => {
    const profile = row.student as unknown as { full_name: string; matric_number: string | null } | null;
    return {
      student_id: row.student_id,
      full_name: profile?.full_name ?? "Unknown",
      matric_number: profile?.matric_number ?? null,
      token: tokenMap.get(row.student_id) ?? "",
    };
  });

  return (
    <div className="page-shell">
      <LiveRefresh sessionId={id} />
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/lecturer/courses">
          <ArrowLeft /> Courses
        </Link>
      </Button>

      <PageHeader
        eyebrow={`${course?.code ?? ""} · ${formatDateTime(session.opens_at)} → ${formatDateTime(session.closes_at)}`}
        title={session.title}
        description="Keep the scanner pointed at student QR codes. Each successful scan resets the scanner for the next student automatically."
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/api/exports/session/${id}`}>
                <Download /> Export class
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/exports/session/${id}?format=pdf`}>
                <FileText /> PDF
              </a>
            </Button>
            <Badge variant={session.status === "open" ? "success" : session.status === "paused" ? "warning" : "secondary"} className="capitalize">
              {session.status}
            </Badge>
            <SessionControls sessionId={id} status={session.status} compact />
          </>
        }
      />

      <ScannerView
        session={{
          id: session.id,
          course_id: session.course_id,
          course_code: course?.code ?? "",
          course_title: course?.title ?? "",
          title: session.title,
          class_date: session.class_date,
          opens_at: session.opens_at,
          closes_at: session.closes_at,
          status: session.status,
        }}
        students={students}
        initialRecords={(records ?? []).map((record) => ({
          student_id: record.student_id,
          status: record.status,
          scanned_at: record.scanned_at,
          sync_source: record.sync_source,
        }))}
        manualAllowed={settings?.allow_manual_qr ?? true}
      />
    </div>
  );
}
