"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignLecturer } from "@/lib/actions/admin";

export function AssignLecturerForm({
  courses,
  lecturers,
}: {
  courses: { id: string; label: string }[];
  lecturers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [courseId, setCourseId] = React.useState("");
  const [lecturerId, setLecturerId] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!courseId || !lecturerId) {
      toast.error("Choose both a course and a lecturer.");
      return;
    }
    startTransition(async () => {
      const result = await assignLecturer(courseId, lecturerId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not assign the lecturer.");
        return;
      }
      toast.success(result.message ?? "Lecturer assigned.");
      setLecturerId("");
      router.refresh();
    });
  }

  const disabled = courses.length === 0 || lecturers.length === 0;

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label>Course</Label>
        <Select value={courseId} onValueChange={setCourseId} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Lecturer</Label>
        <Select value={lecturerId} onValueChange={setLecturerId} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select lecturer" />
          </SelectTrigger>
          <SelectContent>
            {lecturers.map((lecturer) => (
              <SelectItem key={lecturer.id} value={lecturer.id}>
                {lecturer.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={disabled || pending}>
        {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
        Assign
      </Button>
      {disabled && (
        <p className="text-xs text-muted-foreground sm:col-span-3">
          Add at least one course and one lecturer before assigning.
        </p>
      )}
    </form>
  );
}
