"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/actions/admin";
import { importCourseStudentsAction } from "@/lib/actions/course-import";

type ImportData = {
  enrolled: number;
  created: number;
  alreadyRegistered: number;
  failed: number;
  credentials: { name: string; matric: string; email: string; password: string }[];
  errors: string[];
};

export function ImportCourseStudentsDialog({
  courseId,
  courseCode,
}: {
  courseId: string;
  courseCode: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [showForm, setShowForm] = React.useState(true);
  const [fileName, setFileName] = React.useState("");
  const [state, action, pending] = React.useActionState(importCourseStudentsAction, {
    ok: false,
  } as ActionState);

  const data = (state.data ?? null) as ImportData | null;

  React.useEffect(() => {
    if (state.message) {
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
    if (state.data) {
      setShowForm(false);
      router.refresh();
    }
  }, [state, router]);

  function downloadCredentials() {
    if (!data?.credentials.length) return;
    const header = "full_name,matric_number,email,temporary_password\n";
    const rows = data.credentials
      .map(
        (row) =>
          `"${row.name.replace(/"/g, '""')}","${row.matric.replace(/"/g, '""')}","${row.email}","${row.password}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `maideenattendee-${courseCode}-students.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setShowForm(true);
          setFileName("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp /> Import students
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import students into {courseCode}</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file with Matric No, Full Name and Password. New
            students get an account and a permanent QR credential; existing students
            are enrolled without changing their password.
          </DialogDescription>
        </DialogHeader>

        {!data || showForm ? (
          <form action={action} className="space-y-4">
            <input type="hidden" name="course_id" value={courseId} />

            <div className="space-y-1.5">
              <Label htmlFor="course-students-file">Excel workbook or CSV</Label>
              <Input
                id="course-students-file"
                name="file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
              />
              {fileName && <p className="text-xs text-muted-foreground">Selected: {fileName}</p>}
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Expected columns</p>
              <p className="mt-1 font-mono text-[11px]">Matric No · Full Name · Password</p>
              <p className="mt-1">
                All three columns are required for new students. Existing matric numbers
                are matched and enrolled using their current password.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild type="button" variant="outline" size="sm">
                  <a href="/api/templates/course-students">
                    <Download /> Blank Excel template
                  </a>
                </Button>
                <Button asChild type="button" variant="ghost" size="sm">
                  <a href="/templates/course-students-sample.xlsx" download>
                    <Download /> Sample with data
                  </a>
                </Button>
              </div>
            </div>

            {state.message && !state.ok && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {state.message}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Upload />}
                {pending ? "Importing…" : "Import students"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border bg-success/10 p-3 text-center">
                <p className="font-display text-xl font-semibold text-success">{data.enrolled}</p>
                <p className="text-[11px] text-muted-foreground">Enrolled</p>
              </div>
              <div className="rounded-lg border bg-brand-50 p-3 text-center dark:bg-brand-950/40">
                <p className="font-display text-xl font-semibold text-brand-600 dark:text-brand-300">
                  {data.created}
                </p>
                <p className="text-[11px] text-muted-foreground">New accounts</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-center">
                <p className="font-display text-xl font-semibold">{data.alreadyRegistered}</p>
                <p className="text-[11px] text-muted-foreground">Already registered</p>
              </div>
              <div className="rounded-lg border bg-warning/10 p-3 text-center">
                <p className="font-display text-xl font-semibold text-warning">{data.failed}</p>
                <p className="text-[11px] text-muted-foreground">Skipped</p>
              </div>
            </div>

            {data.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
                <p className="font-medium">Skipped rows</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
                  {data.errors.map((error, index) => (
                    <li key={`${index}-${error}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.credentials.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Share these credentials</p>
                  <Button variant="outline" size="sm" onClick={downloadCredentials}>
                    <Download /> CSV
                  </Button>
                </div>
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium">Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.credentials.map((row) => (
                        <tr key={row.matric} className="border-t">
                          <td className="px-3 py-2">
                            <p className="font-medium">{row.name}</p>
                            <p className="text-muted-foreground">{row.matric}</p>
                          </td>
                          <td className="break-all px-3 py-2 font-mono text-[11px]">{row.email}</td>
                          <td className="px-3 py-2 font-mono text-[11px]">{row.password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Passwords are shown once. Students can change them after signing in.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowForm(true)}>
                Import another file
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
