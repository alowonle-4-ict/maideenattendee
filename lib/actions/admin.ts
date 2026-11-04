"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireInstitution } from "@/lib/auth";
import { readTabularFile, type ImportRow } from "@/lib/import-parse";
import { provisionUser, randomPassword, temporaryEmail } from "@/lib/provisioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, unknown>;
}

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function fail(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, message, fieldErrors };
}

function ok(message: string, data?: Record<string, unknown>): ActionState {
  return { ok: true, message, data };
}

function errorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  error.issues.forEach((issue) => {
    const key = issue.path[0];
    if (key && !out[String(key)]) out[String(key)] = issue.message;
  });
  return out;
}

/** Radix Select cannot use an empty value, so optional selects submit "none". */
function optionalId(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  return value === "none" ? "" : value;
}

async function audit(action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  try {
    const { institutionId, user, profile } = await requireInstitution();
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      institution_id: institutionId,
      actor_id: user.id,
      actor_email: profile?.email ?? user.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  } catch {
    // Auditing must never block the primary operation.
  }
}

async function capacity(kind: "students" | "lecturers" | "courses"): Promise<{
  allowed: boolean;
  message?: string;
  limit?: number;
  count?: number;
}> {
  const { institutionId } = await requireInstitution();
  const admin = createAdminClient();

  const [{ data: subscription }, { data: settings }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("status, plan:subscription_plans(max_students, max_lecturers, max_courses, name)")
      .eq("institution_id", institutionId)
      .in("status", ["trialing", "active", "past_due"])
      .maybeSingle(),
    admin
      .from("institution_settings")
      .select("max_students_override, max_lecturers_override, max_courses_override")
      .eq("institution_id", institutionId)
      .maybeSingle(),
  ]);

  const plan = subscription?.plan as unknown as
    | { max_students: number; max_lecturers: number; max_courses: number; name: string }
    | null;

  let limit: number | null = null;
  if (kind === "students") {
    limit = settings?.max_students_override ?? plan?.max_students ?? null;
  } else if (kind === "lecturers") {
    limit = settings?.max_lecturers_override ?? plan?.max_lecturers ?? null;
  } else {
    limit = settings?.max_courses_override ?? plan?.max_courses ?? null;
  }

  if (limit == null) return { allowed: true };

  let count = 0;
  if (kind === "courses") {
    const { count: total } = await admin
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId);
    count = total ?? 0;
  } else {
    const { count: total } = await admin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("role", kind === "students" ? "student" : "lecturer");
    count = total ?? 0;
  }

  if (count >= limit) {
    return {
      allowed: false,
      limit,
      count,
      message: `${kind === "students" ? "Student" : kind === "lecturers" ? "Lecturer" : "Course"} limit reached (${limit} on ${
        plan?.name ?? "your plan"
      }). Upgrade your plan to add more. Existing records are preserved.`,
    };
  }

  return { allowed: true, limit, count };
}

/* ------------------------------------------------------------------ */
/* Faculties                                                           */
/* ------------------------------------------------------------------ */
const facultySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter a faculty name").max(160),
  code: z.string().trim().min(1, "Enter a code").max(20),
});

export async function saveFaculty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const parsed = facultySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) return fail("Check the form", errorsFrom(parsed.error));

  const supabase = await createClient();
  const payload = {
    institution_id: institutionId,
    name: parsed.data.name,
    code: parsed.data.code.toUpperCase(),
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("faculties")
      .update({ name: payload.name, code: payload.code })
      .eq("id", parsed.data.id)
      .eq("institution_id", institutionId);
    if (error) return fail(error.message);
    await audit("faculty_updated", "faculty", parsed.data.id);
  } else {
    const { data, error } = await supabase.from("faculties").insert(payload).select("id").single();
    if (error) return fail(error.message);
    await audit("faculty_created", "faculty", data?.id ?? null);
  }

  revalidatePath("/admin/faculties");
  revalidatePath("/admin/departments");
  return ok("Faculty saved.");
}

export async function deleteFaculty(id: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase
    .from("faculties")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  await audit("faculty_deleted", "faculty", id);
  revalidatePath("/admin/faculties");
  return ok("Faculty deleted.");
}

/* ------------------------------------------------------------------ */
/* Departments                                                         */
/* ------------------------------------------------------------------ */
const departmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter a department name").max(160),
  code: z.string().trim().min(1, "Enter a code").max(20),
  faculty_id: z.string().uuid().optional().or(z.literal("")),
});

export async function saveDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const parsed = departmentSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    code: formData.get("code"),
    faculty_id: optionalId(formData, "faculty_id"),
  });
  if (!parsed.success) return fail("Check the form", errorsFrom(parsed.error));

  const supabase = await createClient();
  const payload = {
    institution_id: institutionId,
    name: parsed.data.name,
    code: parsed.data.code.toUpperCase(),
    faculty_id: parsed.data.faculty_id || null,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("departments")
      .update({ name: payload.name, code: payload.code, faculty_id: payload.faculty_id })
      .eq("id", parsed.data.id)
      .eq("institution_id", institutionId);
    if (error) return fail(error.message);
    await audit("department_updated", "department", parsed.data.id);
  } else {
    const { data, error } = await supabase.from("departments").insert(payload).select("id").single();
    if (error) return fail(error.message);
    await audit("department_created", "department", data?.id ?? null);
  }

  revalidatePath("/admin/departments");
  return ok("Department saved.");
}

export async function deleteDepartment(id: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  await audit("department_deleted", "department", id);
  revalidatePath("/admin/departments");
  return ok("Department deleted.");
}

/* ------------------------------------------------------------------ */
/* Campuses                                                            */
/* ------------------------------------------------------------------ */
const campusSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter a campus name").max(160),
  address: z.string().trim().max(300).optional(),
  is_main: z.string().optional(),
});

export async function saveCampus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const parsed = campusSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    is_main: formData.get("is_main") ?? undefined,
  });
  if (!parsed.success) return fail("Check the form", errorsFrom(parsed.error));

  const supabase = await createClient();
  const payload = {
    institution_id: institutionId,
    name: parsed.data.name,
    address: parsed.data.address ?? null,
    is_main: parsed.data.is_main === "on",
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("campuses")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("institution_id", institutionId);
    if (error) return fail(error.message);
  } else {
    const { error } = await supabase.from("campuses").insert(payload);
    if (error) return fail(error.message);
  }

  revalidatePath("/admin/campuses");
  return ok("Campus saved.");
}

export async function deleteCampus(id: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase
    .from("campuses")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  revalidatePath("/admin/campuses");
  return ok("Campus deleted.");
}

/* ------------------------------------------------------------------ */
/* Academic sessions + semesters                                       */
/* ------------------------------------------------------------------ */
const academicSessionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(4, "Enter a session name").max(40),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
});

export async function saveAcademicSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const parsed = academicSessionSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
  });
  if (!parsed.success) return fail("Check the form", errorsFrom(parsed.error));
  if (parsed.data.end_date <= parsed.data.start_date) {
    return fail("End date must be after the start date.");
  }

  const supabase = await createClient();
  const payload = {
    institution_id: institutionId,
    name: parsed.data.name,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("academic_sessions")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("institution_id", institutionId);
    if (error) return fail(error.message);
  } else {
    const { error } = await supabase.from("academic_sessions").insert(payload);
    if (error) return fail(error.message);
  }

  revalidatePath("/admin/academic-sessions");
  revalidatePath("/admin/semesters");
  return ok("Academic session saved.");
}

export async function deleteAcademicSession(id: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase
    .from("academic_sessions")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  revalidatePath("/admin/academic-sessions");
  return ok("Academic session deleted.");
}

export async function setCurrentAcademicSession(id: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  await supabase
    .from("academic_sessions")
    .update({ is_current: false })
    .eq("institution_id", institutionId);
  const { error } = await supabase
    .from("academic_sessions")
    .update({ is_current: true })
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  revalidatePath("/admin/academic-sessions");
  return ok("Current session updated.");
}

const semesterSchema = z.object({
  id: z.string().uuid().optional(),
  academic_session_id: z.string().uuid("Select an academic session"),
  name: z.string().trim().min(2, "Enter a semester name").max(60),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export async function saveSemester(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const parsed = semesterSchema.safeParse({
    id: formData.get("id") || undefined,
    academic_session_id: formData.get("academic_session_id"),
    name: formData.get("name"),
    start_date: formData.get("start_date") || undefined,
    end_date: formData.get("end_date") || undefined,
  });
  if (!parsed.success) return fail("Check the form", errorsFrom(parsed.error));

  const supabase = await createClient();
  const payload = {
    institution_id: institutionId,
    academic_session_id: parsed.data.academic_session_id,
    name: parsed.data.name,
    start_date: parsed.data.start_date || null,
    end_date: parsed.data.end_date || null,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("semesters")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("institution_id", institutionId);
    if (error) return fail(error.message);
  } else {
    const { error } = await supabase.from("semesters").insert(payload);
    if (error) return fail(error.message);
  }

  revalidatePath("/admin/semesters");
  return ok("Semester saved.");
}

export async function deleteSemester(id: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase
    .from("semesters")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  revalidatePath("/admin/semesters");
  return ok("Semester deleted.");
}

export async function setCurrentSemester(id: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { data: semester } = await supabase
    .from("semesters")
    .select("academic_session_id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!semester) return fail("Semester not found.");

  await supabase
    .from("semesters")
    .update({ is_current: false })
    .eq("academic_session_id", semester.academic_session_id);
  const { error } = await supabase
    .from("semesters")
    .update({ is_current: true })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/semesters");
  return ok("Current semester updated.");
}

/* ------------------------------------------------------------------ */
/* Courses                                                             */
/* ------------------------------------------------------------------ */
const courseSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2, "Enter a course code").max(20),
  title: z.string().trim().min(2, "Enter the course title").max(200),
  department_id: z.string().uuid().optional().or(z.literal("")),
  semester_id: z.string().uuid().optional().or(z.literal("")),
  credit_units: z.coerce.number().int().min(1).max(12),
  level: z.string().trim().max(20).optional(),
  description: z.string().trim().max(2000).optional(),
});

export async function saveCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const parsed = courseSchema.safeParse({
    id: formData.get("id") || undefined,
    code: formData.get("code"),
    title: formData.get("title"),
    department_id: optionalId(formData, "department_id"),
    semester_id: optionalId(formData, "semester_id"),
    credit_units: formData.get("credit_units") ?? 3,
    level: formData.get("level") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return fail("Check the form", errorsFrom(parsed.error));

  if (!parsed.data.id) {
    const check = await capacity("courses");
    if (!check.allowed) return fail(check.message ?? "Plan limit reached.");
  }

  const supabase = await createClient();
  const payload = {
    institution_id: institutionId,
    code: parsed.data.code.toUpperCase(),
    title: parsed.data.title,
    department_id: parsed.data.department_id || null,
    semester_id: parsed.data.semester_id || null,
    credit_units: parsed.data.credit_units,
    level: parsed.data.level ?? null,
    description: parsed.data.description ?? null,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("courses")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("institution_id", institutionId);
    if (error) return fail(error.message);
    await audit("course_updated", "course", parsed.data.id);
  } else {
    const { data, error } = await supabase.from("courses").insert(payload).select("id").single();
    if (error) return fail(error.message);
    await audit("course_created", "course", data?.id ?? null);
  }

  revalidatePath("/admin/courses");
  return ok("Course saved.");
}

export async function deleteCourse(id: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  await audit("course_deleted", "course", id);
  revalidatePath("/admin/courses");
  return ok("Course deleted, including its sessions and registrations.");
}

/* ------------------------------------------------------------------ */
/* Students + lecturers                                                */
/* ------------------------------------------------------------------ */
const studentSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(2, "Enter the student's full name").max(160),
  matric_number: z.string().trim().min(1, "Enter a matric number").max(50),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  department_id: z.string().uuid().optional().or(z.literal("")),
  password: z.string().min(8, "Temporary password must be at least 8 characters").max(72).optional().or(z.literal("")),
});

export async function saveStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const parsed = studentSchema.safeParse({
    id: formData.get("id") || undefined,
    full_name: formData.get("full_name"),
    matric_number: formData.get("matric_number"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || undefined,
    department_id: optionalId(formData, "department_id"),
    password: formData.get("password") || "",
  });
  if (!parsed.success) return fail("Check the form", errorsFrom(parsed.error));

  const supabase = await createClient();
  const admin = createAdminClient();

  if (parsed.data.id) {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        matric_number: parsed.data.matric_number,
        phone: parsed.data.phone ?? null,
        department_id: parsed.data.department_id || null,
      })
      .eq("id", parsed.data.id)
      .eq("institution_id", institutionId);
    if (error) return fail(error.message);
    await audit("student_updated", "student", parsed.data.id);
    revalidatePath("/admin/students");
    return ok("Student updated.");
  }

  const check = await capacity("students");
  if (!check.allowed) return fail(check.message ?? "Plan limit reached.");

  const { data: institution } = await admin
    .from("institutions")
    .select("slug")
    .eq("id", institutionId)
    .maybeSingle();

  const password = parsed.data.password || randomPassword();
  const email =
    parsed.data.email ||
    temporaryEmail(institution?.slug ?? "institution", parsed.data.matric_number);

  try {
    const userId = await provisionUser({
      email,
      password,
      fullName: parsed.data.full_name,
      institutionId,
      role: "student",
      extra: {
        matric_number: parsed.data.matric_number,
        phone: parsed.data.phone ?? null,
        department_id: parsed.data.department_id || null,
      },
    });

    const token = randomBytes(24).toString("hex");
    await admin.from("student_qr_credentials").insert({
      institution_id: institutionId,
      student_id: userId,
      token,
    });

    await audit("student_created", "student", userId, { matric_number: parsed.data.matric_number });

    revalidatePath("/admin/students");
    return ok("Student created. Share these sign-in details securely.", {
      email,
      password,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not create the student.");
  }
}

export async function setStudentActive(id: string, active: boolean): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  await audit(active ? "student_reactivated" : "student_deactivated", "student", id);
  revalidatePath("/admin/students");
  return ok(active ? "Student reactivated." : "Student deactivated.");
}

export async function regenerateQr(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_student_qr", {
    p_student_id: id,
    p_reason: "Administrator regenerated credential",
  });
  if (error) return fail(error.message);
  revalidatePath("/admin/students");
  return ok("A new QR credential has been issued.", { token: data });
}

const lecturerSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(2, "Enter the lecturer's full name").max(160),
  staff_number: z.string().trim().max(50).optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  department_id: z.string().uuid().optional().or(z.literal("")),
  password: z.string().min(8, "Temporary password must be at least 8 characters").max(72).optional().or(z.literal("")),
});

export async function saveLecturer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const parsed = lecturerSchema.safeParse({
    id: formData.get("id") || undefined,
    full_name: formData.get("full_name"),
    staff_number: formData.get("staff_number") || undefined,
    email: formData.get("email") || "",
    phone: formData.get("phone") || undefined,
    department_id: optionalId(formData, "department_id"),
    password: formData.get("password") || "",
  });
  if (!parsed.success) return fail("Check the form", errorsFrom(parsed.error));

  const supabase = await createClient();
  const admin = createAdminClient();

  if (parsed.data.id) {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        staff_number: parsed.data.staff_number ?? null,
        phone: parsed.data.phone ?? null,
        department_id: parsed.data.department_id || null,
      })
      .eq("id", parsed.data.id)
      .eq("institution_id", institutionId);
    if (error) return fail(error.message);
    await audit("lecturer_updated", "lecturer", parsed.data.id);
    revalidatePath("/admin/lecturers");
    return ok("Lecturer updated.");
  }

  const check = await capacity("lecturers");
  if (!check.allowed) return fail(check.message ?? "Plan limit reached.");

  const { data: institution } = await admin
    .from("institutions")
    .select("slug")
    .eq("id", institutionId)
    .maybeSingle();

  const password = parsed.data.password || randomPassword();
  const email =
    parsed.data.email ||
    `${slugify(parsed.data.full_name).slice(0, 30)}.${
      (institution?.slug ?? "inst").slice(0, 16)
    }@staff.maideenattendee.app`;

  try {
    const userId = await provisionUser({
      email,
      password,
      fullName: parsed.data.full_name,
      institutionId,
      role: "lecturer",
      extra: {
        staff_number: parsed.data.staff_number ?? null,
        phone: parsed.data.phone ?? null,
        department_id: parsed.data.department_id || null,
      },
    });

    await audit("lecturer_created", "lecturer", userId);
    revalidatePath("/admin/lecturers");
    return ok("Lecturer created. Share these sign-in details securely.", {
      email,
      password,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not create the lecturer.");
  }
}

export async function setLecturerActive(id: string, active: boolean): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  await audit(active ? "lecturer_reactivated" : "lecturer_deactivated", "lecturer", id);
  revalidatePath("/admin/lecturers");
  return ok(active ? "Lecturer reactivated." : "Lecturer deactivated.");
}

/* ------------------------------------------------------------------ */
/* Assignments + registrations                                         */
/* ------------------------------------------------------------------ */
export async function assignLecturer(courseId: string, lecturerId: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase.from("course_lecturers").insert({
    institution_id: institutionId,
    course_id: courseId,
    lecturer_id: lecturerId,
  });
  if (error) {
    return fail(error.code === "23505" ? "This lecturer is already assigned." : error.message);
  }
  await audit("lecturer_assigned", "course", courseId, { lecturer_id: lecturerId });
  revalidatePath("/admin/assignments");
  return ok("Lecturer assigned.");
}

export async function unassignLecturer(assignmentId: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_lecturers")
    .delete()
    .eq("id", assignmentId)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  await audit("lecturer_unassigned", "course_lecturer", assignmentId);
  revalidatePath("/admin/assignments");
  return ok("Assignment removed.");
}

export async function registerStudents(
  courseId: string,
  academicSessionId: string | null,
  studentIds: string[]
): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  if (studentIds.length === 0) return fail("Select at least one student.");

  const supabase = await createClient();
  const rows = studentIds.map((studentId) => ({
    institution_id: institutionId,
    course_id: courseId,
    student_id: studentId,
    academic_session_id: academicSessionId,
  }));

  const { error } = await supabase.from("course_registrations").upsert(rows, {
    onConflict: academicSessionId
      ? "course_id,student_id,academic_session_id"
      : "course_id,student_id",
    ignoreDuplicates: true,
  });
  if (error) return fail(error.message);
  await audit("students_registered", "course", courseId, { count: studentIds.length });
  revalidatePath("/admin/registrations");
  revalidatePath("/admin/courses");
  return ok(`${studentIds.length} registration${studentIds.length === 1 ? "" : "s"} processed.`);
}

export async function removeRegistration(id: string): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_registrations")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return fail(error.message);
  revalidatePath("/admin/registrations");
  return ok("Registration removed.");
}

/* ------------------------------------------------------------------ */
/* Institution settings                                                */
/* ------------------------------------------------------------------ */
export async function updateInstitutionSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const schema = z.object({
    attendance_threshold: z.coerce.number().int().min(0).max(100),
    late_after_minutes: z.coerce.number().int().min(0).max(180),
    allow_manual_qr: z.string().optional(),
    timezone: z.string().trim().min(1).max(60),
    grace_period_days: z.coerce.number().int().min(0).max(90),
  });
  const parsed = schema.safeParse({
    attendance_threshold: formData.get("attendance_threshold"),
    late_after_minutes: formData.get("late_after_minutes"),
    allow_manual_qr: formData.get("allow_manual_qr") ?? undefined,
    timezone: formData.get("timezone"),
    grace_period_days: formData.get("grace_period_days"),
  });
  if (!parsed.success) return fail("Check the form", errorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("institution_settings")
    .upsert({
      institution_id: institutionId,
      attendance_threshold: parsed.data.attendance_threshold,
      late_after_minutes: parsed.data.late_after_minutes,
      allow_manual_qr: parsed.data.allow_manual_qr === "on",
      timezone: parsed.data.timezone,
      grace_period_days: parsed.data.grace_period_days,
    });
  if (error) return fail(error.message);

  await audit("institution_settings_updated", "institution_settings", institutionId);
  revalidatePath("/admin/settings");
  return ok("Settings saved.");
}

/* ------------------------------------------------------------------ */
/* Institution branding                                                */
/* ------------------------------------------------------------------ */
function imageType(bytes: Uint8Array): { ext: "png" | "jpg" | "webp"; mime: string } | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", mime: "image/png" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export async function updateInstitutionLogo(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const admin = createAdminClient();
  const bucket = admin.storage.from("institution-assets");

  if (formData.get("intent") === "remove") {
    await bucket.remove([
      `${institutionId}/logo.png`,
      `${institutionId}/logo.jpg`,
      `${institutionId}/logo.webp`,
    ]);
    const { error } = await admin
      .from("institutions")
      .update({ logo_url: null })
      .eq("id", institutionId);
    if (error) return fail(error.message);

    await audit("institution_logo_removed", "institution", institutionId);
    revalidatePath("/admin/settings");
    revalidatePath("/admin", "layout");
    revalidatePath("/lecturer", "layout");
    revalidatePath("/student", "layout");
    return ok("Institution logo removed.");
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose a PNG, JPEG or WebP image to upload.");
  }
  if (file.size > 2 * 1024 * 1024) {
    return fail("Logo is too large. Maximum size is 2 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) {
    return fail("Unsupported image. Upload a PNG, JPEG or WebP file.");
  }

  const path = `${institutionId}/logo.${type.ext}`;
  const { error: uploadError } = await bucket.upload(path, bytes, {
    contentType: type.mime,
    upsert: true,
    cacheControl: "3600",
  });

  if (uploadError) {
    if (/bucket.*not found|not found/i.test(uploadError.message)) {
      return fail(
        "Logo storage is not configured. Apply supabase/migrations/20260101000300_storage_branding.sql, then try again."
      );
    }
    return fail(uploadError.message);
  }

  const { data: urlData } = bucket.getPublicUrl(path);
  const logoUrl = `${urlData.publicUrl}?v=${Date.now()}`;
  const { error } = await admin
    .from("institutions")
    .update({ logo_url: logoUrl })
    .eq("id", institutionId);
  if (error) return fail(error.message);

  await bucket.remove(
    (["png", "jpg", "webp"] as const)
      .filter((ext) => ext !== type.ext)
      .map((ext) => `${institutionId}/logo.${ext}`)
  );

  await audit("institution_logo_updated", "institution", institutionId);
  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");
  revalidatePath("/lecturer", "layout");
  revalidatePath("/student", "layout");
  return ok("Institution logo updated.");
}

/* ------------------------------------------------------------------ */
/* Bulk import                                                         */
/* ------------------------------------------------------------------ */
export async function importStudentsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose a CSV or Excel file to import.");
  }
  if (file.size > 3 * 1024 * 1024) {
    return fail("File is too large. Maximum size is 3 MB.");
  }

  let records: ImportRow[] = [];
  try {
    records = await readTabularFile(file);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not read the file.");
  }

  records = records.filter(
    (record) => (record.full_name || record.name) && (record.matric_number || record.matric)
  );

  if (records.length === 0) {
    return fail(
      "No usable rows found. Required columns: full_name, matric_number. Optional: email, phone, department_code, password."
    );
  }
  if (records.length > 1000) {
    return fail("Import up to 1,000 students at a time.");
  }

  const admin = createAdminClient();
  const capacityInfo = await capacity("students");
  if (!capacityInfo.allowed) {
    return fail(capacityInfo.message ?? "Student limit reached.");
  }

  const remaining =
    capacityInfo.limit != null && capacityInfo.count != null
      ? capacityInfo.limit - capacityInfo.count
      : records.length;

  if (records.length > remaining) {
    return fail(
      `This import has ${records.length} students but your plan only allows ${remaining} more. Upgrade or reduce the file.`
    );
  }

  const { data: institution } = await admin
    .from("institutions")
    .select("slug")
    .eq("id", institutionId)
    .maybeSingle();

  const [{ data: departments }, { data: existingProfiles }] = await Promise.all([
    admin.from("departments").select("id, code").eq("institution_id", institutionId),
    admin
      .from("profiles")
      .select("email, matric_number")
      .eq("institution_id", institutionId)
      .not("matric_number", "is", null),
  ]);

  const departmentByCode = new Map<string, string>();
  (departments ?? []).forEach((department) => {
    departmentByCode.set(String(department.code).toUpperCase(), department.id as string);
  });

  const existingMatric = new Set(
    (existingProfiles ?? []).map((profile) => String(profile.matric_number).toLowerCase())
  );
  const existingEmails = new Set(
    (existingProfiles ?? []).map((profile) => String(profile.email).toLowerCase())
  );

  const credentials: { name: string; matric: string; email: string; password: string }[] = [];
  const errors: string[] = [];
  let created = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const fullName = (record.full_name || record.name || "").trim();
    const matric = (record.matric_number || record.matric || "").trim();
    const rowLabel = `Row ${index + 2}`;

    if (!fullName || !matric) {
      errors.push(`${rowLabel}: name and matric number are required.`);
      continue;
    }
    if (existingMatric.has(matric.toLowerCase())) {
      errors.push(`${rowLabel}: ${matric} already exists.`);
      continue;
    }

    const email = (record.email || "").trim() ||
      temporaryEmail(institution?.slug ?? "institution", matric);
    if (existingEmails.has(email.toLowerCase())) {
      errors.push(`${rowLabel}: ${email} is already registered.`);
      continue;
    }

    const password =
      record.password && record.password.length >= 8 ? record.password : randomPassword();

    try {
      const userId = await provisionUser({
        email,
        password,
        fullName,
        institutionId,
        role: "student",
        extra: {
          matric_number: matric,
          phone: record.phone || null,
          department_id: departmentByCode.get((record.department_code || "").toUpperCase()) ?? null,
        },
      });

      await admin.from("student_qr_credentials").insert({
        institution_id: institutionId,
        student_id: userId,
        token: randomBytes(24).toString("hex"),
      });

      existingMatric.add(matric.toLowerCase());
      existingEmails.add(email.toLowerCase());
      credentials.push({ name: fullName, matric, email, password });
      created += 1;
    } catch (error) {
      errors.push(
        `${rowLabel}: ${error instanceof Error ? error.message : "could not create account"}`
      );
    }
  }

  await audit("students_imported", "institution", institutionId, {
    created,
    failed: errors.length,
  });
  revalidatePath("/admin/students");

  return {
    ok: created > 0,
    message: `Imported ${created} of ${records.length} students.${
      errors.length ? ` ${errors.length} row${errors.length === 1 ? "" : "s"} skipped.` : ""
    }`,
    data: {
      created,
      failed: errors.length,
      credentials,
      errors: errors.slice(0, 30),
    },
  };
}
