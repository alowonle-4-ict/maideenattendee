/**
 * MaideenAttendee demo seed.
 *
 * Creates two isolated tenants, staff/student accounts, QR credentials,
 * attendance history and trials — enough to exercise every dashboard.
 *
 * Usage:
 *   1. npx supabase start
 *   2. npx supabase db reset        (applies migrations + reference plans)
 *   3. Copy the service-role key into .env.local
 *   4. npm run db:seed
 *
 * Demo accounts are for local/staging only. Never run this against a
 * production database that contains real users.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(file) {
  const path = join(root, file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error(
    [
      "SUPABASE_SERVICE_ROLE_KEY is not set.",
      "",
      "For local Supabase:",
      "  1. npx supabase start",
      "  2. npx supabase status -o env",
      "  3. Add SUPABASE_SERVICE_ROLE_KEY=... to .env.local",
      "",
      "The service role key is required because the seed creates auth users and",
      "writes tenant data outside RLS. Never expose it to the browser.",
    ].join("\n")
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL ?? "superadmin@maideenattendee.app";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "Demo#Maideen2026";

function must(result, label) {
  if (result?.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result?.data;
}

function dateStr(date) {
  return date.toISOString().slice(0, 10);
}

function lagosIso(dateStrValue, hour, minute = 0) {
  return `${dateStrValue}T${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0"
  )}:00+01:00`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

async function ensureUser(email, password, fullName) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (created.data?.user) {
    return created.data.user;
  }

  const message = created.error?.message ?? "";
  if (!/already|exists|registered/i.test(message) && created.error?.status !== 422) {
    throw new Error(`Could not create ${email}: ${message}`);
  }

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) {
      await admin.auth.admin.updateUserById(match.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      return match;
    }
    if (data.users.length < 200) break;
  }

  throw new Error(`Could not find or create the account ${email}.`);
}

async function upsertProfile(userId, email, values) {
  must(
    await admin.from("profiles").upsert(
      {
        id: userId,
        full_name: values.full_name,
        email,
        institution_id: values.institution_id ?? null,
        phone: values.phone ?? null,
        department_id: values.department_id ?? null,
        matric_number: values.matric_number ?? null,
        staff_number: values.staff_number ?? null,
        is_active: true,
      },
      { onConflict: "id" }
    ),
    `profile ${email}`
  );
}

async function setRole(userId, institutionId, role) {
  must(
    await admin
      .from("user_roles")
      .upsert({ user_id: userId, institution_id: institutionId, role }, { onConflict: "user_id" }),
    `role ${role}`
  );
}

async function ensureRow(table, match, values) {
  let query = admin.from(table).select("*").limit(1);
  for (const [key, value] of Object.entries(match)) query = query.eq(key, value);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${table} lookup: ${error.message}`);
  if (data) return data;

  const { data: created, error: insertError } = await admin
    .from(table)
    .insert({ ...match, ...values })
    .select("*")
    .single();
  if (insertError) throw new Error(`${table} insert: ${insertError.message}`);
  return created;
}

async function ensureQr(studentId, institutionId) {
  const { data } = await admin
    .from("student_qr_credentials")
    .select("token")
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  if (data?.token) return data.token;

  const token = randomBytes(24).toString("hex");
  must(
    await admin
      .from("student_qr_credentials")
      .insert({ institution_id: institutionId, student_id: studentId, token }),
    "QR credential"
  );
  return token;
}

function academicYear(now) {
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    name: `${startYear}/${startYear + 1}`,
    start: `${startYear}-09-14`,
    end: `${startYear + 1}-07-30`,
    firstSemester: {
      name: "First Semester",
      start: `${startYear}-09-14`,
      end: `${startYear + 1}-01-29`,
    },
    secondSemester: {
      name: "Second Semester",
      start: `${startYear + 1}-02-15`,
      end: `${startYear + 1}-07-09`,
    },
  };
}

const tenants = [
  {
    institution: {
      name: "Maideen Demo University",
      slug: "maideen-demo",
      short_name: "MDU",
      email: "registrar@demo.maideenattendee.app",
      phone: "+234 802 000 1000",
      address: "12 Knowledge Avenue, Ibadan, Oyo State",
      status: "active",
    },
    settings: {
      attendance_threshold: 75,
      late_after_minutes: 15,
      allow_manual_qr: true,
      timezone: "Africa/Lagos",
      grace_period_days: 7,
    },
    planSlug: "professional",
    admin: {
      email: "admin@demo.maideenattendee.app",
      fullName: "Amina Bello",
      staffNumber: "MDU/ADM/001",
    },
    faculties: [
      { name: "Faculty of Science & Computing", code: "SCI" },
      { name: "Faculty of Management Sciences", code: "MGT" },
    ],
    departments: [
      { name: "Computer Science", code: "CSC", faculty: "SCI" },
      { name: "Software Engineering", code: "SEN", faculty: "SCI" },
      { name: "Business Administration", code: "BUS", faculty: "MGT" },
    ],
    campuses: [
      { name: "Main Campus", address: "12 Knowledge Avenue, Ibadan", is_main: true },
      { name: "City Campus", address: "4 Ring Road, Ibadan", is_main: false },
    ],
    lecturers: [
      {
        email: "csc.lecturer@demo.maideenattendee.app",
        fullName: "Dr. Ibrahim Sule",
        staffNumber: "MDU/CSC/010",
        department: "CSC",
        courses: ["CSC301", "CSC305"],
      },
      {
        email: "sen.lecturer@demo.maideenattendee.app",
        fullName: "Dr. Chiamaka Okafor",
        staffNumber: "MDU/SEN/011",
        department: "SEN",
        courses: ["SEN311", "SEN315"],
      },
      {
        email: "bus.lecturer@demo.maideenattendee.app",
        fullName: "Mrs. Funke Adeyemi",
        staffNumber: "MDU/BUS/012",
        department: "BUS",
        courses: ["BUS201", "BUS205"],
      },
    ],
    courses: [
      {
        code: "CSC301",
        title: "Data Structures and Algorithms",
        department: "CSC",
        level: "300",
        credit_units: 3,
      },
      {
        code: "CSC305",
        title: "Database Systems",
        department: "CSC",
        level: "300",
        credit_units: 3,
      },
      {
        code: "SEN311",
        title: "Mobile Application Development",
        department: "SEN",
        level: "300",
        credit_units: 3,
      },
      {
        code: "SEN315",
        title: "Software Testing and Quality",
        department: "SEN",
        level: "300",
        credit_units: 2,
      },
      {
        code: "BUS201",
        title: "Principles of Management",
        department: "BUS",
        level: "200",
        credit_units: 2,
      },
      {
        code: "BUS205",
        title: "Business Statistics",
        department: "BUS",
        level: "200",
        credit_units: 3,
      },
    ],
    students: [
      { fullName: "Tunde Adebayo", matric: "MDU/CSC/25/001", department: "CSC", courses: ["CSC301", "CSC305"] },
      { fullName: "Ngozi Eze", matric: "MDU/CSC/25/002", department: "CSC", courses: ["CSC301", "CSC305"] },
      { fullName: "Musa Danjuma", matric: "MDU/CSC/25/003", department: "CSC", courses: ["CSC301", "CSC305"] },
      { fullName: "Blessing Okon", matric: "MDU/CSC/25/004", department: "CSC", courses: ["CSC301", "CSC305"] },
      { fullName: "David Ogunleye", matric: "MDU/SEN/25/001", department: "SEN", courses: ["SEN311", "SEN315"] },
      { fullName: "Halima Yusuf", matric: "MDU/SEN/25/002", department: "SEN", courses: ["SEN311", "SEN315"] },
      { fullName: "Emeka Nwosu", matric: "MDU/SEN/25/003", department: "SEN", courses: ["SEN311", "SEN315"] },
      { fullName: "Zainab Lawal", matric: "MDU/BUS/25/001", department: "BUS", courses: ["BUS201", "BUS205"] },
      { fullName: "Peter Akpan", matric: "MDU/BUS/25/002", department: "BUS", courses: ["BUS201", "BUS205"] },
      { fullName: "Rukayat Salami", matric: "MDU/BUS/25/003", department: "BUS", courses: ["BUS201", "BUS205"] },
    ],
  },
  {
    institution: {
      name: "Crescent Polytechnic",
      slug: "crescent-poly",
      short_name: "CPT",
      email: "registry@crescent.maideenattendee.app",
      phone: "+234 803 000 2000",
      address: "9 Unity Road, Abuja",
      status: "active",
    },
    settings: {
      attendance_threshold: 70,
      late_after_minutes: 10,
      allow_manual_qr: false,
      timezone: "Africa/Lagos",
      grace_period_days: 5,
    },
    planSlug: "starter",
    admin: {
      email: "admin@crescent.maideenattendee.app",
      fullName: "Samuel Oche",
      staffNumber: "CPT/ADM/001",
    },
    faculties: [{ name: "School of Engineering", code: "ENG" }],
    departments: [
      { name: "Computer Engineering", code: "CPE", faculty: "ENG" },
      { name: "Electrical Engineering", code: "EEE", faculty: "ENG" },
    ],
    campuses: [{ name: "Main Campus", address: "9 Unity Road, Abuja", is_main: true }],
    lecturers: [
      {
        email: "cpe.lecturer@crescent.maideenattendee.app",
        fullName: "Engr. Grace Umeh",
        staffNumber: "CPT/CPE/010",
        department: "CPE",
        courses: ["CPE201", "CPE205"],
      },
    ],
    courses: [
      {
        code: "CPE201",
        title: "Digital Logic Design",
        department: "CPE",
        level: "200",
        credit_units: 3,
      },
      {
        code: "CPE205",
        title: "Microprocessors and Interfacing",
        department: "CPE",
        level: "200",
        credit_units: 3,
      },
    ],
    students: [
      { fullName: "Joy Ademola", matric: "CPT/CPE/25/001", department: "CPE", courses: ["CPE201", "CPE205"] },
      { fullName: "Yusuf Aliyu", matric: "CPT/CPE/25/002", department: "CPE", courses: ["CPE201", "CPE205"] },
      { fullName: "Chidinma Obi", matric: "CPT/CPE/25/003", department: "CPE", courses: ["CPE201", "CPE205"] },
      { fullName: "Bashir Mohammed", matric: "CPT/CPE/25/004", department: "CPE", courses: ["CPE201", "CPE205"] },
    ],
  },
];

async function seedTenant(config, plansBySlug, year) {
  const institution = await ensureRow(
    "institutions",
    { slug: config.institution.slug },
    config.institution
  );

  must(
    await admin.from("institution_settings").upsert(
      { institution_id: institution.id, ...config.settings },
      { onConflict: "institution_id" }
    ),
    "institution settings"
  );

  const facultyByCode = new Map();
  for (const faculty of config.faculties) {
    const row = await ensureRow(
      "faculties",
      { institution_id: institution.id, code: faculty.code },
      { name: faculty.name }
    );
    facultyByCode.set(faculty.code, row);
  }

  const departmentByCode = new Map();
  for (const department of config.departments) {
    const row = await ensureRow(
      "departments",
      { institution_id: institution.id, code: department.code },
      {
        name: department.name,
        faculty_id: facultyByCode.get(department.faculty)?.id ?? null,
      }
    );
    departmentByCode.set(department.code, row);
  }

  for (const campus of config.campuses) {
    await ensureRow(
      "campuses",
      { institution_id: institution.id, name: campus.name },
      { address: campus.address, is_main: campus.is_main }
    );
  }

  const academicSession = await ensureRow(
    "academic_sessions",
    { institution_id: institution.id, name: year.name },
    { start_date: year.start, end_date: year.end, is_current: true }
  );

  const firstSemester = await ensureRow(
    "semesters",
    { academic_session_id: academicSession.id, name: year.firstSemester.name },
    {
      institution_id: institution.id,
      start_date: year.firstSemester.start,
      end_date: year.firstSemester.end,
      is_current: true,
    }
  );
  await ensureRow(
    "semesters",
    { academic_session_id: academicSession.id, name: year.secondSemester.name },
    {
      institution_id: institution.id,
      start_date: year.secondSemester.start,
      end_date: year.secondSemester.end,
      is_current: false,
    }
  );

  const adminUser = await ensureUser(
    config.admin.email,
    DEMO_PASSWORD,
    config.admin.fullName
  );
  await upsertProfile(adminUser.id, config.admin.email, {
    full_name: config.admin.fullName,
    institution_id: institution.id,
    staff_number: config.admin.staffNumber,
  });
  await setRole(adminUser.id, institution.id, "institution_admin");

  const courseByCode = new Map();
  for (const course of config.courses) {
    const row = await ensureRow(
      "courses",
      { institution_id: institution.id, code: course.code },
      {
        title: course.title,
        department_id: departmentByCode.get(course.department)?.id ?? null,
        semester_id: firstSemester.id,
        level: course.level,
        credit_units: course.credit_units,
        description: `${course.title} — demo course seeded for MaideenAttendee.`,
      }
    );
    courseByCode.set(course.code, row);
  }

  const lecturerByCourse = new Map();
  for (const lecturer of config.lecturers) {
    const user = await ensureUser(lecturer.email, DEMO_PASSWORD, lecturer.fullName);
    await upsertProfile(user.id, lecturer.email, {
      full_name: lecturer.fullName,
      institution_id: institution.id,
      staff_number: lecturer.staffNumber,
      department_id: departmentByCode.get(lecturer.department)?.id ?? null,
    });
    await setRole(user.id, institution.id, "lecturer");

    for (const courseCode of lecturer.courses) {
      const course = courseByCode.get(courseCode);
      if (!course) continue;
      lecturerByCourse.set(courseCode, user);
      must(
        await admin.from("course_lecturers").upsert(
          {
            institution_id: institution.id,
            course_id: course.id,
            lecturer_id: user.id,
          },
          { onConflict: "course_id,lecturer_id" }
        ),
        "course lecturer"
      );
    }
  }

  const students = [];
  for (const [index, student] of config.students.entries()) {
    const email = `student${index + 1}@${config.institution.slug}.maideenattendee.app`;
    const user = await ensureUser(email, DEMO_PASSWORD, student.fullName);
    await upsertProfile(user.id, email, {
      full_name: student.fullName,
      institution_id: institution.id,
      matric_number: student.matric,
      department_id: departmentByCode.get(student.department)?.id ?? null,
    });
    await setRole(user.id, institution.id, "student");
    const token = await ensureQr(user.id, institution.id);

    for (const courseCode of student.courses) {
      const course = courseByCode.get(courseCode);
      if (!course) continue;
      must(
        await admin.from("course_registrations").upsert(
          {
            institution_id: institution.id,
            course_id: course.id,
            student_id: user.id,
            academic_session_id: academicSession.id,
            status: "registered",
          },
          { onConflict: "course_id,student_id,academic_session_id" }
        ),
        "course registration"
      );
    }

    students.push({ ...student, id: user.id, email, token });
  }

  const now = new Date();
  const plan = plansBySlug.get(config.planSlug) ?? plansBySlug.values().next().value;
  const { data: liveSubscription } = await admin
    .from("subscriptions")
    .select("id")
    .eq("institution_id", institution.id)
    .in("status", ["trialing", "active", "past_due"])
    .maybeSingle();

  if (!liveSubscription && plan) {
    const trialEnds = new Date(now.getTime() + 14 * 86_400_000);
    must(
      await admin.from("subscriptions").insert({
        institution_id: institution.id,
        plan_id: plan.id,
        status: "trialing",
        starts_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        auto_renew: false,
      }),
      "demo subscription"
    );
  }

  let sessionCount = 0;
  let recordCount = 0;

  for (const course of config.courses) {
    const courseRow = courseByCode.get(course.code);
    const lecturer = lecturerByCourse.get(course.code);
    if (!courseRow || !lecturer) continue;

    const registered = students.filter((student) => student.courses.includes(course.code));

    const pastDays = [21, 14, 7];
    for (const [weekIndex, daysAgo] of pastDays.entries()) {
      const classDate = dateStr(new Date(now.getTime() - daysAgo * 86_400_000));
      const opens = lagosIso(classDate, 9);
      const closes = lagosIso(classDate, 10);
      const session = await ensureRow(
        "attendance_sessions",
        { course_id: courseRow.id, class_date: classDate, title: "Weekly lecture" },
        {
          institution_id: institution.id,
          lecturer_id: lecturer.id,
          opens_at: opens,
          closes_at: closes,
          location: "Lecture Hall A",
          status: "closed",
          opened_at: opens,
          closed_at: closes,
          created_by: lecturer.id,
        }
      );
      sessionCount += 1;

      for (const student of registered) {
        const bucket = hashString(`${student.id}:${session.id}:${weekIndex}`) % 100;
        if (bucket >= 84) continue;
        const status = bucket < 12 ? "late" : "present";
        const scannedAt = new Date(
          new Date(opens).getTime() + (5 + (bucket % 20)) * 60_000
        ).toISOString();
        must(
          await admin.from("attendance_records").upsert(
            {
              institution_id: institution.id,
              attendance_session_id: session.id,
              student_id: student.id,
              course_id: courseRow.id,
              recorded_by: lecturer.id,
              status,
              method: "qr",
              scanned_at: scannedAt,
              sync_source: "online",
              is_verified: true,
              device_info: "MaideenAttendee demo seed",
            },
            { onConflict: "attendance_session_id,student_id" }
          ),
          "attendance record"
        );
        recordCount += 1;
      }
    }

    const tomorrow = dateStr(new Date(now.getTime() + 86_400_000));
    await ensureRow(
      "attendance_sessions",
      { course_id: courseRow.id, class_date: tomorrow, title: "Weekly lecture" },
      {
        institution_id: institution.id,
        lecturer_id: lecturer.id,
        opens_at: lagosIso(tomorrow, 9),
        closes_at: lagosIso(tomorrow, 10),
        location: "Lecture Hall A",
        status: "scheduled",
        created_by: lecturer.id,
      }
    );
    sessionCount += 1;
  }

  const firstCourse = courseByCode.get(config.courses[0].code);
  const firstLecturer = lecturerByCourse.get(config.courses[0].code);
  if (firstCourse && firstLecturer) {
    const today = dateStr(now);
    const opens = new Date(now.getTime() - 30 * 60_000).toISOString();
    const closes = new Date(now.getTime() + 60 * 60_000).toISOString();
    await ensureRow(
      "attendance_sessions",
      { course_id: firstCourse.id, class_date: today, title: "Live demo session" },
      {
        institution_id: institution.id,
        lecturer_id: firstLecturer.id,
        opens_at: opens,
        closes_at: closes,
        location: "Lecture Hall A",
        status: "open",
        opened_at: opens,
        created_by: firstLecturer.id,
      }
    );
    sessionCount += 1;
  }

  for (const student of students) {
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", student.id)
      .eq("title", "Welcome to MaideenAttendee")
      .maybeSingle();
    if (!existing) {
      await admin.from("notifications").insert({
        institution_id: institution.id,
        user_id: student.id,
        title: "Welcome to MaideenAttendee",
        body: "Your permanent QR code is ready. Show it to your lecturer when attendance opens. You can view this code even without a network connection once the app has loaded.",
        type: "info",
        link: "/student/qr",
      });
    }
  }

  const { data: existingTicket } = await admin
    .from("support_tickets")
    .select("id")
    .eq("institution_id", institution.id)
    .eq("subject", "Bulk student import for a new semester")
    .maybeSingle();
  if (!existingTicket) {
    await admin.from("support_tickets").insert({
      institution_id: institution.id,
      created_by: adminUser.id,
      subject: "Bulk student import for a new semester",
      body: "We are onboarding 420 students next month. Does the Excel import validate matric numbers and generate QR codes automatically? We would also like to confirm the plan limits before the term starts.",
      status: "open",
      priority: "normal",
    });
  }

  return {
    institution,
    admin: config.admin,
    lecturers: config.lecturers,
    students,
    sessionCount,
    recordCount,
  };
}

async function main() {
  console.log(`Seeding MaideenAttendee at ${url}`);

  const superUser = await ensureUser(
    SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PASSWORD,
    "Platform Administrator"
  );
  await upsertProfile(superUser.id, SUPER_ADMIN_EMAIL, {
    full_name: "Platform Administrator",
  });
  await setRole(superUser.id, null, "super_admin");

  const plans = must(
    await admin.from("subscription_plans").select("id, slug, name").order("sort_order"),
    "subscription plans"
  );
  if (!plans?.length) {
    throw new Error(
      "No subscription plans found. Run `npx supabase db reset` so the reference-data migration runs first."
    );
  }
  const plansBySlug = new Map(plans.map((plan) => [plan.slug, plan]));

  const year = academicYear(new Date());
  const summary = [];
  for (const tenant of tenants) {
    summary.push(await seedTenant(tenant, plansBySlug, year));
  }

  console.log("");
  console.log("Seed complete.");
  console.log("");
  console.log("Super administrator");
  console.log(`  ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);
  console.log("");
  for (const [index, tenant] of summary.entries()) {
    console.log(`${tenant.institution.name} (/${tenant.institution.slug})`);
    console.log(`  Admin:   ${tenant.admin.email} / ${DEMO_PASSWORD}`);
    for (const lecturer of tenant.lecturers) {
      console.log(`  Lecturer:${lecturer.email} / ${DEMO_PASSWORD}`);
    }
    console.log(
      `  Students:${tenant.students.length} accounts (student1..${tenant.students.length}@${
        tenants[index].institution.slug
      }.maideenattendee.app)`
    );
    console.log(
      `  Seeded ${tenant.sessionCount} sessions and ${tenant.recordCount} attendance records.`
    );
    console.log("");
  }
  console.log("All demo accounts use the password above. Change or delete them");
  console.log("before deploying a shared environment.");
}

main().catch((error) => {
  console.error("");
  console.error("Seed failed:", error.message);
  process.exit(1);
});
