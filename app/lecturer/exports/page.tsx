import { FileSpreadsheet, FileText } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function LecturerExportsPage() {
  const ctx = await requireAuth(["lecturer"]);
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("course_lecturers")
    .select("course:courses(id, code, title)")
    .eq("lecturer_id", ctx.user.id);

  const courses = (assignments ?? [])
    .map((row) => row.course as unknown as { id: string; code: string; title: string } | null)
    .filter((course): course is NonNullable<typeof course> => course !== null);

  const ids = courses.map((course) => course.id);
  const { data: sessions } = ids.length
    ? await supabase
        .from("attendance_sessions")
        .select("id, title, class_date, status, course:courses(code)")
        .in("course_id", ids)
        .eq("lecturer_id", ctx.user.id)
        .in("status", ["open", "closed"])
        .order("class_date", { ascending: false })
        .limit(50)
    : { data: [] as { id: string; title: string; class_date: string; status: string; course: unknown }[] };

  return (
    <div className="page-shell">
      <PageHeader
        title="Excel and PDF exports"
        description="Download attendance data for your assigned courses. Every report includes the institution, course, lecturer, academic session and semester."
      />

      <SectionCard title="Course reports" description="Only courses assigned to you are listed." contentClassName="p-0">
        {courses.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Report type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <p className="font-mono text-xs text-muted-foreground">{course.code}</p>
                    <p className="font-medium">{course.title}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/exports/course/${course.id}?type=register`}>
                          <FileSpreadsheet /> Full register
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/exports/course/${course.id}?type=summary`}>
                          <FileSpreadsheet /> Student summary
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/exports/course/${course.id}?format=pdf&type=summary`}>
                          <FileText /> PDF summary
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No courses are assigned to you.</p>
        )}
      </SectionCard>

      <div className="mt-6">
        <SectionCard title="Individual class exports" description="Type A report: one row per student for a single class." contentClassName="p-0">
          {sessions && sessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const course = session.course as unknown as { code: string } | null;
                  return (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.title}</TableCell>
                      <TableCell className="font-mono text-xs">{course?.code}</TableCell>
                      <TableCell className="text-sm">{formatDate(session.class_date)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/api/exports/session/${session.id}`}>
                              <FileSpreadsheet /> Excel
                            </a>
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/api/exports/session/${session.id}?format=pdf`}>
                              <FileText /> PDF
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No completed sessions to export yet.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
