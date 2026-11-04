# Demo account credentials

> **Public demo credentials.** This repository is public. These accounts exist only to
> demonstrate the platform with seeded demo data. Never reuse these passwords for real
> institutions or production data, and rotate them before any pilot or deployment that holds
> real student records.

These are the accounts created by [`scripts/seed.mjs`](scripts/seed.mjs). The seed is
**demo/staging only** — it creates two isolated tenants, staff, students, QR credentials,
past attendance sessions and trial subscriptions.

## Before these credentials work

The accounts exist only after the migrations and seed have been applied to the Supabase
project the app points at:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npm run db:seed        # needs SUPABASE_SERVICE_ROLE_KEY in .env.local
```

Vercel does not run the seed. A freshly connected Supabase project has no accounts until
you run the commands above against it.

## Default passwords

| Account | Email | Password |
| --- | --- | --- |
| Super admin (platform owner) | `superadmin@maideenattendee.app` | `ChangeMe123!` |
| Every institution admin, lecturer and student | see tables below | `Demo#Maideen2026` |

Override the defaults at seed time with `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` and
`SEED_PASSWORD`. If you override them, the values in this file no longer apply.

## Super admin

Signs in at `/login` and lands on `/platform`. Manages institutions, plans, subscriptions,
support tickets, audit log and platform settings.

| Name | Email | Password |
| --- | --- | --- |
| Platform super admin | `superadmin@maideenattendee.app` | `ChangeMe123!` |

## Maideen Demo University (`maideen-demo`)

Active tenant on the Professional plan, 75% attendance threshold, 15-minute late grace.

### Institution admin

| Name | Email | Password |
| --- | --- | --- |
| Amina Bello | `admin@demo.maideenattendee.app` | `Demo#Maideen2026` |

### Lecturers

| Name | Email | Password | Assigned courses |
| --- | --- | --- | --- |
| Dr. Ibrahim Sule | `csc.lecturer@demo.maideenattendee.app` | `Demo#Maideen2026` | CSC301, CSC305 |
| Dr. Chiamaka Okafor | `sen.lecturer@demo.maideenattendee.app` | `Demo#Maideen2026` | SEN311, SEN315 |
| Mrs. Funke Adeyemi | `bus.lecturer@demo.maideenattendee.app` | `Demo#Maideen2026` | BUS201, BUS205 |

### Students

| Name | Matric number | Email | Password |
| --- | --- | --- | --- |
| Tunde Adebayo | MDU/CSC/25/001 | `student1@maideen-demo.maideenattendee.app` | `Demo#Maideen2026` |
| Ngozi Eze | MDU/CSC/25/002 | `student2@maideen-demo.maideenattendee.app` | `Demo#Maideen2026` |
| Musa Danjuma | MDU/CSC/25/003 | `student3@maideen-demo.maideenattendee.app` | `Demo#Maideen2026` |
| Blessing Okon | MDU/CSC/25/004 | `student4@maideen-demo.maideenattendee.app` | `Demo#Maideen2026` |
| David Ogunleye | MDU/SEN/25/001 | `student5@maideen-demo.maideenattendee.app` | `Demo#Maideen2026` |
| Halima Yusuf | MDU/SEN/25/002 | `student6@maideen-demo.maideenattendee.app` | `Demo#Maideen2026` |
| Emeka Nwosu | MDU/SEN/25/003 | `student7@maideen-demo.maideenattendee.app` | `Demo#Maideen2026` |
| Zainab Lawal | MDU/BUS/25/001 | `student8@maideen-demo.maideenattendee.app` | `Demo#Maideen2026` |
| Peter Akpan | MDU/BUS/25/002 | `student9@maideen-demo.maideenattendee.app` | `Demo#Maideen2026` |
| Rukayat Salami | MDU/BUS/25/003 | `student10@maideen-demo.maideenattendee.app` | `Demo#Maideen2026` |

## Crescent Polytechnic (`crescent-poly`)

Active tenant on the Starter plan, 70% attendance threshold, 10-minute late grace,
manual QR entry disabled.

### Institution admin

| Name | Email | Password |
| --- | --- | --- |
| Samuel Oche | `admin@crescent.maideenattendee.app` | `Demo#Maideen2026` |

### Lecturer

| Name | Email | Password | Assigned courses |
| --- | --- | --- | --- |
| Engr. Grace Umeh | `cpe.lecturer@crescent.maideenattendee.app` | `Demo#Maideen2026` | CPE201, CPE205 |

### Students

| Name | Matric number | Email | Password |
| --- | --- | --- | --- |
| Joy Ademola | CPT/CPE/25/001 | `student1@crescent-poly.maideenattendee.app` | `Demo#Maideen2026` |
| Yusuf Aliyu | CPT/CPE/25/002 | `student2@crescent-poly.maideenattendee.app` | `Demo#Maideen2026` |
| Chidinma Obi | CPT/CPE/25/003 | `student3@crescent-poly.maideenattendee.app` | `Demo#Maideen2026` |
| Bashir Mohammed | CPT/CPE/25/004 | `student4@crescent-poly.maideenattendee.app` | `Demo#Maideen2026` |

## Where each role lands

| Role | Home |
| --- | --- |
| Super admin | `/platform` |
| Institution admin | `/admin` |
| Lecturer | `/lecturer` |
| Student | `/student` |

All roles sign in through `/login`; the app routes to the correct dashboard automatically.
The seed signs users in without email confirmation, so no inbox setup is required.

## Rotating for production

Before onboarding a real institution, create accounts through the app's own registration
and invitation flows, or re-run the seed with strong overrides:

```bash
SUPER_ADMIN_PASSWORD='<strong-unique-password>' \
SEED_PASSWORD='<strong-unique-password>' \
npm run db:seed
```

Seeded demo tenants, students and attendance history can be removed from the database when
the demo period ends.
