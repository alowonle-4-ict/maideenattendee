"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { registerStudents } from "@/lib/actions/admin";

export interface StudentOption {
  id: string;
  name: string;
  matric: string;
  department: string | null;
}

export function RegisterStudentsForm({
  courseId,
  academicSessionId,
  students,
}: {
  courseId: string;
  academicSessionId: string | null;
  students: StudentOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(term) ||
        student.matric.toLowerCase().includes(term) ||
        (student.department ?? "").toLowerCase().includes(term)
    );
  }, [query, students]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selected.includes(s.id));

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleAll() {
    if (allVisibleSelected) {
      const visible = new Set(filtered.map((s) => s.id));
      setSelected((current) => current.filter((id) => !visible.has(id)));
    } else {
      setSelected((current) => Array.from(new Set([...current, ...filtered.map((s) => s.id)])));
    }
  }

  function submit() {
    if (selected.length === 0) {
      toast.error("Select at least one student.");
      return;
    }
    startTransition(async () => {
      const result = await registerStudents(courseId, academicSessionId, selected);
      if (!result.ok) {
        toast.error(result.message ?? "Could not register the selected students.");
        return;
      }
      toast.success(result.message ?? "Students registered.");
      setSelected([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by name, matric number or department"
          className="pl-9"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
          <span>Select all shown ({filtered.length})</span>
        </label>
        <span className="text-muted-foreground">{selected.length} selected</span>
      </div>

      <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border p-1.5">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {students.length === 0
              ? "Every active student is already registered for this course."
              : "No students match this filter."}
          </p>
        ) : (
          filtered.map((student) => (
            <label
              key={student.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-muted/60"
            >
              <Checkbox checked={selected.includes(student.id)} onCheckedChange={() => toggle(student.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{student.name}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {student.matric}
                  {student.department ? ` · ${student.department}` : ""}
                </span>
              </span>
            </label>
          ))
        )}
      </div>

      <Button onClick={submit} disabled={pending || selected.length === 0} className="w-full sm:w-auto">
        {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
        Register {selected.length > 0 ? `${selected.length} student${selected.length === 1 ? "" : "s"}` : "students"}
      </Button>
    </div>
  );
}
