"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, CalendarClock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createAttendanceSession } from "@/lib/actions/attendance";

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function SessionForm({
  courses,
}: {
  courses: { id: string; label: string; students: number }[];
}) {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(createAttendanceSession, { ok: false });
  const [courseId, setCourseId] = React.useState(courses.length === 1 ? courses[0].id : "");
  const [startNow, setStartNow] = React.useState(true);
  const [opensAt, setOpensAt] = React.useState(() => toLocalInput(new Date()));
  const [closesAt, setClosesAt] = React.useState(() => toLocalInput(new Date(Date.now() + 2 * 60 * 60_000)));
  const [today] = React.useState(() => toLocalInput(new Date()).slice(0, 10));

  React.useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      const sessionId = state.data?.sessionId;
      if (typeof sessionId === "string") router.push(`/lecturer/scan/${sessionId}`);
    } else {
      toast.error(state.message);
    }
  }, [state, router]);

  const selected = courses.find((course) => course.id === courseId);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <Label>Course</Label>
        <Select name="course_id" value={courseId} onValueChange={setCourseId}>
          <SelectTrigger>
            <SelectValue placeholder="Select one of your courses" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.label} · {course.students} students
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.course_id && (
          <p className="text-[11px] text-destructive">{state.fieldErrors.course_id}</p>
        )}
        {selected && selected.students === 0 && (
          <p className="text-[11px] text-warning">
            No students are registered for this course yet. Ask your administrator to register students.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">Class title or topic</Label>
          <Input id="title" name="title" required placeholder="e.g. Week 6 — Binary Search Trees" />
          {state.fieldErrors?.title && <p className="text-[11px] text-destructive">{state.fieldErrors.title}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="class_date">Class date</Label>
          <Input id="class_date" name="class_date" type="date" required defaultValue={today} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="location">Classroom / location (optional)</Label>
          <Input id="location" name="location" placeholder="e.g. Lecture Theatre 2" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opens_at">Attendance opens</Label>
          <Input
            id="opens_at"
            name="opens_at"
            type="datetime-local"
            required
            value={opensAt}
            onChange={(event) => setOpensAt(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="closes_at">Attendance closes</Label>
          <Input
            id="closes_at"
            name="closes_at"
            type="datetime-local"
            required
            value={closesAt}
            onChange={(event) => setClosesAt(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Anything students should know about this class" />
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Start attendance immediately</p>
          <p className="text-xs text-muted-foreground">
            When off, the session is scheduled and opens automatically at the configured time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={startNow} onCheckedChange={setStartNow} />
          <input type="hidden" name="start_now" value={startNow ? "on" : "off"} />
        </div>
      </div>

      {state.message && !state.ok && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending || courses.length === 0}>
        {pending ? <Loader2 className="animate-spin" /> : startNow ? <Play /> : <CalendarClock />}
        {pending ? "Creating…" : startNow ? "Start attendance" : "Schedule attendance"}
      </Button>
    </form>
  );
}
