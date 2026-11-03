"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/actions/admin";
import { requireAuth } from "@/lib/auth";
import { pickValue, readTabularFile, type ImportRow } from "@/lib/import-parse";
import { provisionUser, temporaryEmail } from "@/lib/provisioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MATRIC_KEYS = ["matric_no", "matric_number", "matric", "matricno", "matriculation_number"];
const NAME_KEYS = ["full_name", "name", "student_name", "fullname"];
const PASSWORD_KEYS = ["password", "temporary_password", "pass_word"];

const MAX_ROWS = 1000;
const MAX_FILE_BYTES = 3 * 1024 * 1024;

function fail(message: string): ActionState {
  return { ok: false, message };
}

async function studentCapacity(institutionId: string) {
  const admin = createAdminClient();
  const [{ data: subscription }, { data: settings }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("status, plan:subscription_plans(max_students, name)")
      .eq("institution_id", institutionId)
      .in("status", ["trialing", "active", "past_due"])
      .maybeSingle(),
    admin
      .from("institution_settings")
      .select("max_students_override")
      .eq("institution_id", institutionId)
      .maybeSingle(),
  ]);

  const plan = subscription?.plan as unknown as { max_students: number; name: string } | null;
  const limit = settings?.max_students_override ?? plan?.max_students ?? null;
  if (limit == null) return { limit: null, count: 0, planName: plan?.name ?? null };

  const { count } = await admin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("institution_id", institutionId)
    .eq("role", "student");

  return { limit, count: count ?? 0, planName: plan?.name ?? null };
}

export async function importCourseStudentsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuth(["lecturer"]);
  if (!ctx.institutionId) return fail("Your account is not linked to an institution.");

  const parsed = z
    .object({ course_id: z.string().uuid("Choose a valid course.") })
    .safeParse({ course_id: formData.get("course_id") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Choose a valid course.");
  const courseId = parsed.data.course_id;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose an Excel or CSV file to import.");
  }
  if (file.size > MAX_FILE_BYTES) {
    return fail("File is too large. Maximum size is 3 MB.");
  }

  const supabase = await createClient();
  const institutionId = ctx.institutionId;

  // Assignment is verified with the lecturer's own session, not the service role.
  const { data: assignment } = await supabase
    .from("course_lecturers")
    .select("id")
    .eq("course_id", courseId)
    .eq("lecturer_id", ctx.user.id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!assignment) {
    return fail("You are not assigned to this course. Imports are limited to your assigned courses.");
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, code, title, semester:semesters(academic_session_id)")
    .eq("id", courseId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!course) return fail("Course not found.");

  let academicSessionId =
    (course.semester as unknown as { academic_session_id: string | null } | null)
      ?.academic_session_id ?? null;

  if (!academicSessionId) {
    const { data: currentSession } = await supabase
      .from("academic_sessions")
      .select("id")
      .eq("institution_id", institutionId)
      .eq("is_current", true)
      .maybeSingle();
    academicSessionId = currentSession?.id ?? null;
  }

  let records: ImportRow[] = [];
  try {
    records = await readTabularFile(file);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not read the file.");
  }

  records = records.filter((record) =>
    Boolean(
      pickValue(record, MATRIC_KEYS) ||
        pickValue(record, NAME_KEYS) ||
        pickValue(record, PASSWORD_KEYS)
    )
  );

  if (records.length === 0) {
    return fail(
      "No rows found. The first sheet needs the columns: Matric No, Full Name, Password."
    );
  }
  if (records.length > MAX_ROWS) {
    return fail(`Import up to ${MAX_ROWS} students at a time.`);
  }
  if (!records.some((record) => pickValue(record, MATRIC_KEYS))) {
    return fail("The file needs a Matric No column.");
  }
  if (!records.some((record) => pickValue(record, NAME_KEYS))) {
    return fail("The file needs a Full Name column.");
  }

  const admin = createAdminClient();

  const [{ data: institution }, { data: profiles }, { data: studentRoles }] = await Promise.all([
    admin.from("institutions").select("slug").eq("id", institutionId).maybeSingle(),
    admin
      .from("profiles")
      .select("id, full_name, email, matric_number, is_active")
      .eq("institution_id", institutionId)
      .not("matric_number", "is", null),
    admin
      .from("user_roles")
      .select("user_id")
      .eq("institution_id", institutionId)
      .eq("role", "student"),
  ]);

  const studentIds = new Set((studentRoles ?? []).map((row) => row.user_id as string));
  const profileByMatric = new Map<
    string,
    { id: string; full_name: string; email: string; is_active: boolean }
  >();
  const existingEmails = new Set<string>();

  (profiles ?? []).forEach((profile) => {
    const matric = String(profile.matric_number ?? "").trim().toLowerCase();
    if (!matric) return;
    existingEmails.add(String(profile.email ?? "").toLowerCase());
    if (!studentIds.has(profile.id as string)) return;
    if (!profileByMatric.has(matric)) {
      profileByMatric.set(matric, {
        id: profile.id as string,
        full_name: String(profile.full_name ?? ""),
        email: String(profile.email ?? ""),
        is_active: profile.is_active !== false,
      });
    }
  });

  const uniqueMatrics = new Set<string>();
  records.forEach((record) => {
    const matric = pickValue(record, MATRIC_KEYS).toLowerCase();
    if (matric) uniqueMatrics.add(matric);
  });
  const newAccountCount = Array.from(uniqueMatrics).filter(
    (matric) => !profileByMatric.has(matric)
  ).length;

  const capacity = await studentCapacity(institutionId);
  if (capacity.limit != null && newAccountCount > Math.max(capacity.limit - capacity.count, 0)) {
    const remaining = Math.max(capacity.limit - capacity.count, 0);
    return fail(
      `This import creates ${newAccountCount} new student account${
        newAccountCount === 1 ? "" : "s"
      }, but ${capacity.planName ?? "your plan"} only allows ${remaining} more. Upgrade the plan or split the file. Existing students do not count toward the limit.`
    );
  }

  const { data: existingRegistrations } = await admin
    .from("course_registrations")
    .select("id, student_id, status, academic_session_id")
    .eq("institution_id", institutionId)
    .eq("course_id", courseId);

  type ExistingRegistration = {
    id: string;
    student_id: string;
    status: string;
    academic_session_id: string | null;
  };
  const registrationsByStudent = new Map<string, ExistingRegistration[]>();
  ((existingRegistrations ?? []) as ExistingRegistration[]).forEach((row) => {
    const rows = registrationsByStudent.get(row.student_id) ?? [];
    rows.push(row);
    registrationsByStudent.set(row.student_id, rows);
  });

  function findDroppedForSession(studentId: string) {
    return (registrationsByStudent.get(studentId) ?? []).find(
      (row) => row.status === "dropped" && row.academic_session_id === academicSessionId
    );
  }

  const credentials: { name: string; matric: string; email: string; password: string }[] = [];
  const errors: string[] = [];
  const pendingRegistrations: { label: string; row: Record<string, unknown> }[] = [];
  const reactivations: { label: string; id: string }[] = [];
  const seenMatric = new Set<string>();
  let created = 0;
  let alreadyRegistered = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const label = `Row ${index + 2}`;
    const fullName = pickValue(record, NAME_KEYS);
    const matric = pickValue(record, MATRIC_KEYS);
    const password = pickValue(record, PASSWORD_KEYS);

    if (!matric) {
      errors.push(`${label}: Matric No is required.`);
      continue;
    }
    if (!fullName) {
      errors.push(`${label}: Full Name is required.`);
      continue;
    }
    if (matric.length > 50) {
      errors.push(`${label}: Matric No must be 50 characters or fewer.`);
      continue;
    }
    if (!/[a-z0-9]/i.test(matric)) {
      errors.push(`${label}: Matric No must contain letters or numbers.`);
      continue;
    }
    if (fullName.length > 160) {
      errors.push(`${label}: Full Name must be 160 characters or fewer.`);
      continue;
    }

    const matricKey = matric.toLowerCase();
    if (seenMatric.has(matricKey)) {
      errors.push(`${label}: ${matric} appears more than once in this file.`);
      continue;
    }
    seenMatric.add(matricKey);

    const existing = profileByMatric.get(matricKey);

    if (existing) {
      if (!existing.is_active) {
        errors.push(`${label}: ${matric} belongs to a deactivated account. Ask an administrator to reactivate it.`);
        continue;
      }
      const currentRows = registrationsByStudent.get(existing.id) ?? [];
      if (currentRows.some((row) => row.status === "registered")) {
        alreadyRegistered += 1;
        continue;
      }

      const dropped = findDroppedForSession(existing.id);
      if (dropped) {
        reactivations.push({ label, id: dropped.id });
      } else {
        pendingRegistrations.push({
          label,
          row: {
            institution_id: institutionId,
            course_id: courseId,
            student_id: existing.id,
            academic_session_id: academicSessionId,
            status: "registered",
          },
        });
      }
      continue;
    }

    if (password.length < 8) {
      errors.push(`${label}: Password must be at least 8 characters for a new student account.`);
      continue;
    }
    if (password.length > 72) {
      errors.push(`${label}: Password must be 72 characters or fewer.`);
      continue;
    }

    const email = temporaryEmail(institution?.slug ?? "institution", matric);

    if (existingEmails.has(email.toLowerCase())) {
      errors.push(`${label}: The generated sign-in email ${email} is already in use.`);
      continue;
    }

    try {
      const studentId = await provisionUser({
        email,
        password,
        fullName,
        institutionId,
        role: "student",
        extra: { matric_number: matric },
      });

      const { error: qrError } = await admin.from("student_qr_credentials").insert({
        institution_id: institutionId,
        student_id: studentId,
        token: randomBytes(24).toString("hex"),
      });

      if (qrError) {
        await admin.auth.admin.deleteUser(studentId).catch(() => undefined);
        errors.push(`${label}: Could not issue a QR credential (${qrError.message}).`);
        continue;
      }

      existingEmails.add(email.toLowerCase());
      profileByMatric.set(matricKey, {
        id: studentId,
        full_name: fullName,
        email,
        is_active: true,
      });
      credentials.push({ name: fullName, matric, email, password });
      created += 1;
      pendingRegistrations.push({
        label,
        row: {
          institution_id: institutionId,
          course_id: courseId,
          student_id: studentId,
          academic_session_id: academicSessionId,
          status: "registered",
        },
      });
    } catch (error) {
      errors.push(
        `${label}: ${error instanceof Error ? error.message : "Could not create the student account."}`
      );
    }
  }

  let enrolled = 0;

  if (reactivations.length > 0) {
    const { data: reactivated, error } = await admin
      .from("course_registrations")
      .update({ status: "registered", registered_at: new Date().toISOString() })
      .in("id", reactivations.map((entry) => entry.id))
      .eq("institution_id", institutionId)
      .eq("course_id", courseId)
      .select("id");

    if (!error) {
      enrolled += reactivated?.length ?? reactivations.length;
    } else {
      reactivations.forEach((entry) => {
        errors.push(`${entry.label}: could not reactivate the course registration (${error.message}).`);
      });
    }
  }

  if (pendingRegistrations.length > 0) {
    const { error } = await admin
      .from("course_registrations")
      .insert(pendingRegistrations.map((entry) => entry.row));

    if (!error) {
      enrolled += pendingRegistrations.length;
    } else {
      for (const entry of pendingRegistrations) {
        const { error: rowError } = await admin.from("course_registrations").insert(entry.row);
        if (!rowError || rowError.code === "23505") {
          enrolled += 1;
        } else {
          errors.push(`${entry.label}: account ready but course registration failed (${rowError.message}).`);
        }
      }
    }
  }

  try {
    await admin.from("audit_logs").insert({
      institution_id: institutionId,
      actor_id: ctx.user.id,
      actor_email: ctx.profile?.email ?? ctx.user.email,
      action: "course_students_imported",
      entity_type: "course",
      entity_id: courseId,
      metadata: {
        course_code: course.code,
        created,
        enrolled,
        already_registered: alreadyRegistered,
        failed: errors.length,
      },
    });
  } catch {
    // Auditing must never block the import result.
  }

  revalidatePath(`/lecturer/courses/${courseId}`);
  revalidatePath("/lecturer/students");
  revalidatePath("/admin/students");
  revalidatePath("/admin/registrations");

  const message = `Enrolled ${enrolled} student${enrolled === 1 ? "" : "s"} in ${course.code}. ${
    created > 0 ? `${created} new account${created === 1 ? "" : "s"} created. ` : ""
  }${alreadyRegistered > 0 ? `${alreadyRegistered} already registered. ` : ""}${
    errors.length > 0 ? `${errors.length} row${errors.length === 1 ? "" : "s"} skipped.` : ""
  }`.trim();

  return {
    ok: enrolled > 0 || (alreadyRegistered > 0 && errors.length === 0),
    message,
    data: {
      enrolled,
      created,
      alreadyRegistered,
      failed: errors.length,
      credentials,
      errors: errors.slice(0, 40),
    },
  };
}
