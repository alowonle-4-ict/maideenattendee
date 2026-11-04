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
import { importStudentsAction } from "@/lib/actions/admin";

type ImportData = {
  created: number;
  failed: number;
  credentials: { name: string; matric: string; email: string; password: string }[];
  errors: string[];
};

const TEMPLATE = `full_name,matric_number,email,phone,department_code,password
Amina Bello,2023/CSC/041,,08030000000,CSC,
Chinedu Okafor,2023/CSC/017,,,CSC,
`;

export function ImportStudentsDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = React.useActionState(importStudentsAction, {
    ok: false,
  } as ActionState);
  const [fileName, setFileName] = React.useState("");
  const data = (state.data ?? null) as ImportData | null;

  React.useEffect(() => {
    if (state.message) {
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
    if (state.ok) router.refresh();
  }, [state, router]);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "maideenattendee-students-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

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
    link.download = "maideenattendee-imported-students.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import students</DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX file. Each student receives an account and a
            permanent QR credential. Emails and passwords are generated when
            omitted.
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="file">CSV or Excel workbook</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
              />
              {fileName && (
                <p className="text-xs text-muted-foreground">Selected: {fileName}</p>
              )}
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Expected columns</p>
              <p className="mt-1 font-mono text-[11px]">
                full_name, matric_number, email, phone, department_code, password
              </p>
              <p className="mt-1">Only full_name and matric_number are required.</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <a
                  href="/templates/students-import-sample.xlsx"
                  download
                  className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  <Download className="h-3 w-3" /> Sample Excel workbook
                </a>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  <Download className="h-3 w-3" /> CSV template
                </button>
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
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-success/10 p-3 text-center">
                <p className="font-display text-xl font-semibold text-success">{data.created}</p>
                <p className="text-[11px] text-muted-foreground">Created</p>
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
                  {data.errors.map((error) => (
                    <li key={error}>{error}</li>
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
                  Passwords are shown once. Distribute them securely — each student
                  can change their password after signing in.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
