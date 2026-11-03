-- =====================================================================
-- MaideenAttendee — initial schema
-- Multi-tenant QR attendance SaaS
-- =====================================================================

create extension if not exists "pgcrypto";

do $$
begin
  create extension if not exists "pg_cron" schema extensions;
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end
$$;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.app_role as enum (
  'super_admin', 'institution_admin', 'lecturer', 'student'
);
create type public.institution_status as enum (
  'pending', 'active', 'suspended', 'deleted'
);
create type public.session_status as enum (
  'scheduled', 'open', 'paused', 'closed', 'cancelled'
);
create type public.attendance_status as enum (
  'present', 'late', 'excused', 'absent'
);
create type public.attendance_method as enum ('qr', 'manual', 'correction');
create type public.sync_source as enum ('online', 'offline');
create type public.qr_status as enum ('active', 'revoked');
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'expired', 'pending', 'cancelled'
);
create type public.billing_cycle as enum ('monthly', 'semester', 'annual', 'custom');
create type public.payment_status as enum (
  'pending', 'success', 'failed', 'abandoned', 'refunded'
);
create type public.payment_gateway as enum ('paystack', 'flutterwave');
create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');

-- ---------------------------------------------------------------------
-- Core tenant tables
-- ---------------------------------------------------------------------
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_name text,
  email text not null,
  phone text,
  address text,
  logo_url text,
  status public.institution_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institution_settings (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  primary_color text not null default '#1e2a5a',
  attendance_threshold integer not null default 75 check (attendance_threshold between 0 and 100),
  late_after_minutes integer not null default 15 check (late_after_minutes >= 0),
  allow_manual_qr boolean not null default true,
  timezone text not null default 'Africa/Lagos',
  grace_period_days integer not null default 7 check (grace_period_days >= 0),
  max_students_override integer,
  max_lecturers_override integer,
  max_courses_override integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.faculties (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, code)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  faculty_id uuid references public.faculties(id) on delete set null,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, code)
);

create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  address text,
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  matric_number text,
  staff_number text,
  department_id uuid references public.departments(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_matric_unique
  on public.profiles (institution_id, matric_number)
  where matric_number is not null;
create unique index profiles_staff_unique
  on public.profiles (institution_id, staff_number)
  where staff_number is not null;
create index profiles_institution_idx on public.profiles (institution_id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id),
  constraint role_institution_check check (
    (role = 'super_admin' and institution_id is null)
    or (role <> 'super_admin' and institution_id is not null)
  )
);
create index user_roles_institution_idx on public.user_roles (institution_id, role);

-- ---------------------------------------------------------------------
-- Academic structure
-- ---------------------------------------------------------------------
create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, name),
  constraint academic_session_dates check (end_date > start_date)
);

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_session_id uuid not null references public.academic_sessions(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_session_id, name)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  code text not null,
  title text not null,
  description text,
  credit_units integer not null default 3 check (credit_units between 1 and 12),
  level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, code)
);
create index courses_department_idx on public.courses (department_id);
create index courses_semester_idx on public.courses (semester_id);

create table public.course_lecturers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lecturer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, lecturer_id)
);
create index course_lecturers_lecturer_idx on public.course_lecturers (lecturer_id);

create table public.course_registrations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  academic_session_id uuid references public.academic_sessions(id) on delete set null,
  status text not null default 'registered' check (status in ('registered', 'dropped')),
  registered_at timestamptz not null default now(),
  unique (course_id, student_id, academic_session_id)
);
create index course_registrations_student_idx on public.course_registrations (student_id);
create index course_registrations_course_idx on public.course_registrations (course_id);
create unique index course_registrations_no_session_unique
  on public.course_registrations (course_id, student_id)
  where academic_session_id is null;

-- ---------------------------------------------------------------------
-- QR credentials
-- ---------------------------------------------------------------------
create table public.student_qr_credentials (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  status public.qr_status not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null
);
create unique index student_qr_one_active
  on public.student_qr_credentials (student_id)
  where status = 'active';
create index student_qr_institution_idx on public.student_qr_credentials (institution_id);

-- ---------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lecturer_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  class_date date not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  location text,
  notes text,
  status public.session_status not null default 'scheduled',
  opened_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_window check (closes_at > opens_at)
);
create index attendance_sessions_course_idx on public.attendance_sessions (course_id, class_date desc);
create index attendance_sessions_lecturer_idx on public.attendance_sessions (lecturer_id, class_date desc);
create index attendance_sessions_institution_idx on public.attendance_sessions (institution_id, status);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  attendance_session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  recorded_by uuid references public.profiles(id) on delete set null,
  status public.attendance_status not null default 'present',
  method public.attendance_method not null default 'qr',
  scanned_at timestamptz not null default now(),
  local_scanned_at timestamptz,
  client_transaction_id uuid unique,
  sync_source public.sync_source not null default 'online',
  device_info text,
  is_verified boolean not null default true,
  created_at timestamptz not null default now(),
  unique (attendance_session_id, student_id)
);
create index attendance_records_student_idx on public.attendance_records (student_id, scanned_at desc);
create index attendance_records_institution_idx on public.attendance_records (institution_id, scanned_at desc);
create index attendance_records_course_idx on public.attendance_records (course_id);

create table public.attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  attendance_record_id uuid references public.attendance_records(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price_ngn numeric(12, 2) not null default 0 check (price_ngn >= 0),
  billing_cycle public.billing_cycle not null default 'monthly',
  duration_days integer not null default 30 check (duration_days > 0),
  max_students integer not null default 100 check (max_students > 0),
  max_lecturers integer not null default 10 check (max_lecturers > 0),
  max_courses integer not null default 10 check (max_courses > 0),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status public.subscription_status not null default 'trialing',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  trial_ends_at timestamptz,
  auto_renew boolean not null default false,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscriptions_one_live
  on public.subscriptions (institution_id)
  where status in ('trialing', 'active', 'past_due');

create table public.subscription_usage (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  period_start date not null,
  period_end date,
  students_count integer not null default 0,
  lecturers_count integer not null default 0,
  courses_count integer not null default 0,
  computed_at timestamptz not null default now(),
  unique (institution_id, period_start)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null default 'NGN',
  gateway public.payment_gateway not null,
  reference text not null unique,
  gateway_reference text,
  status public.payment_status not null default 'pending',
  customer_email text not null,
  authorization_url text,
  channel text,
  paid_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_institution_idx on public.payments (institution_id, created_at desc);
create index payments_status_idx on public.payments (status);
create index payments_gateway_idx on public.payments (gateway);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway public.payment_gateway not null,
  event_id text,
  event_type text,
  payload jsonb not null,
  signature_valid boolean not null default false,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);
create unique index payment_webhook_events_unique
  on public.payment_webhook_events (gateway, event_id)
  where event_id is not null;

-- ---------------------------------------------------------------------
-- Platform operations
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  subject text not null,
  body text not null,
  status public.ticket_status not null default 'open',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_institution_idx on public.audit_logs (institution_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'institutions', 'institution_settings', 'faculties', 'departments',
    'campuses', 'profiles', 'academic_sessions', 'semesters', 'courses',
    'attendance_sessions', 'subscription_plans', 'subscriptions',
    'payments', 'support_tickets'
  ]
  loop
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Auth helper functions (security definer to avoid RLS recursion)
-- ---------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.user_roles where user_id = auth.uid();
$$;

create or replace function public.current_institution_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select institution_id from public.user_roles where user_id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.belongs_to_institution(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and institution_id = p_institution_id
  );
$$;

create or replace function public.is_institution_admin(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and institution_id = p_institution_id
      and role = 'institution_admin'
  );
$$;

create or replace function public.is_lecturer_assigned(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.course_lecturers
    where course_id = p_course_id and lecturer_id = auth.uid()
  );
$$;

create or replace function public.is_registered_for_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.course_registrations
    where course_id = p_course_id
      and student_id = auth.uid()
      and status = 'registered'
  );
$$;

-- ---------------------------------------------------------------------
-- Profile bootstrap for auth users
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Self-service profile edits must not be able to move a user between tenants
-- or change identity fields managed by administrators.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_super_admin() or public.is_institution_admin(old.institution_id) then
    return new;
  end if;

  if new.institution_id is distinct from old.institution_id
     or new.email is distinct from old.email
     or new.matric_number is distinct from old.matric_number
     or new.staff_number is distinct from old.staff_number
     or new.department_id is distinct from old.department_id
     or new.is_active is distinct from old.is_active then
    raise exception 'This profile field can only be changed by an administrator';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------
-- Attendance engine
-- ---------------------------------------------------------------------
create or replace function public.record_attendance(
  p_session_id uuid,
  p_qr_token text,
  p_client_tx_id uuid default null,
  p_local_scanned_at timestamptz default null,
  p_device_info text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.attendance_sessions%rowtype;
  v_student public.profiles%rowtype;
  v_cred public.student_qr_credentials%rowtype;
  v_course public.courses%rowtype;
  v_settings public.institution_settings%rowtype;
  v_existing public.attendance_records%rowtype;
  v_record public.attendance_records%rowtype;
  v_session_start timestamptz;
  v_is_offline boolean := p_local_scanned_at is not null;
  v_scan_time timestamptz;
  v_status public.attendance_status;
  v_recent_scans integer;
  v_late_after integer := 15;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'ERROR', 'message', 'Not authenticated.');
  end if;

  select * into v_session from public.attendance_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'SESSION_NOT_FOUND', 'message', 'Attendance session not found.');
  end if;

  if not (
    public.is_super_admin()
    or (public.belongs_to_institution(v_session.institution_id)
        and (public.current_app_role() = 'institution_admin'
             or (public.current_app_role() = 'lecturer' and v_session.lecturer_id = v_uid)))
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'You are not assigned to this course.');
  end if;

  if public.current_app_role() = 'lecturer' and not public.is_lecturer_assigned(v_session.course_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_ASSIGNED', 'message', 'You are not assigned to this course.');
  end if;

  select * into v_settings from public.institution_settings where institution_id = v_session.institution_id;
  if found then
    v_late_after := v_settings.late_after_minutes;
  end if;

  -- Rate limiting: 300 scans per minute per recorder.
  select count(*) into v_recent_scans
  from public.attendance_records
  where recorded_by = v_uid and created_at > now() - interval '1 minute';
  if v_recent_scans > 300 then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED', 'message', 'Too many scans. Please wait a moment.');
  end if;

  -- Idempotency for offline replays.
  if p_client_tx_id is not null then
    select * into v_existing from public.attendance_records where client_transaction_id = p_client_tx_id;
    if found then
      select * into v_student from public.profiles where id = v_existing.student_id;
      return jsonb_build_object(
        'ok', true, 'code', 'DUPLICATE', 'duplicate', true,
        'message', 'This scan has already been synchronized.',
        'student', jsonb_build_object('id', v_student.id, 'full_name', v_student.full_name, 'matric_number', v_student.matric_number),
        'scanned_at', v_existing.scanned_at
      );
    end if;
  end if;

  -- Resolve the opaque QR credential.
  select * into v_cred from public.student_qr_credentials where token = p_qr_token;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_QR', 'message', 'This QR code is not recognised.');
  end if;
  if v_cred.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'QR_REVOKED', 'message', 'This QR credential has been revoked.');
  end if;

  select * into v_student from public.profiles where id = v_cred.student_id;
  if not found or not v_student.is_active then
    return jsonb_build_object('ok', false, 'code', 'STUDENT_INACTIVE', 'message', 'This student account is not active.');
  end if;

  if v_student.institution_id is distinct from v_session.institution_id then
    return jsonb_build_object('ok', false, 'code', 'WRONG_INSTITUTION', 'message', 'This student belongs to a different institution.');
  end if;

  select * into v_course from public.courses where id = v_session.course_id;

  if not exists (
    select 1 from public.course_registrations
    where course_id = v_session.course_id
      and student_id = v_student.id
      and status = 'registered'
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_REGISTERED', 'message', 'This student is not registered for this course.');
  end if;

  -- Server-authoritative window. Offline replays are accepted when the local
  -- scan time falls inside the official window and arrives within 24h grace.
  v_scan_time := coalesce(p_local_scanned_at, now());

  if v_is_offline then
    if v_scan_time < v_session.opens_at or v_scan_time > v_session.closes_at then
      return jsonb_build_object('ok', false, 'code', 'OUTSIDE_WINDOW', 'message', 'Offline scan falls outside the attendance window.');
    end if;
    if now() > v_session.closes_at + interval '24 hours' then
      return jsonb_build_object('ok', false, 'code', 'SESSION_CLOSED', 'message', 'This offline session is too old to synchronize.');
    end if;
    if v_session.status = 'cancelled' then
      return jsonb_build_object('ok', false, 'code', 'SESSION_CLOSED', 'message', 'This attendance session was cancelled.');
    end if;
  else
    if v_session.status in ('paused', 'closed', 'cancelled') then
      return jsonb_build_object('ok', false, 'code', 'SESSION_CLOSED', 'message', 'Attendance is not open for this session.');
    end if;
    if now() < v_session.opens_at then
      return jsonb_build_object('ok', false, 'code', 'OUTSIDE_WINDOW', 'message', 'Attendance has not opened yet.');
    end if;
    if now() > v_session.closes_at then
      return jsonb_build_object('ok', false, 'code', 'SESSION_CLOSED', 'message', 'Attendance has closed for this session.');
    end if;
    if v_session.status = 'scheduled' then
      update public.attendance_sessions
      set status = 'open', opened_at = coalesce(opened_at, now())
      where id = v_session.id and status = 'scheduled';
    end if;
  end if;

  v_status := case
    when v_scan_time > v_session.opens_at + make_interval(mins => v_late_after) then 'late'::public.attendance_status
    else 'present'::public.attendance_status
  end;

  -- Atomic duplicate prevention via the unique (session, student) constraint.
  insert into public.attendance_records (
    institution_id, attendance_session_id, student_id, course_id, recorded_by,
    status, method, scanned_at, local_scanned_at, client_transaction_id,
    sync_source, device_info
  ) values (
    v_session.institution_id, v_session.id, v_student.id, v_session.course_id, v_uid,
    v_status, 'qr', now(), p_local_scanned_at, p_client_tx_id,
    case when v_is_offline then 'offline'::public.sync_source else 'online'::public.sync_source end,
    p_device_info
  )
  on conflict (attendance_session_id, student_id) do nothing
  returning * into v_record;

  if v_record.id is null then
    select * into v_existing from public.attendance_records
    where attendance_session_id = v_session.id and student_id = v_student.id;
    return jsonb_build_object(
      'ok', true, 'code', 'DUPLICATE', 'duplicate', true,
      'message', 'Attendance already recorded for this student.',
      'student', jsonb_build_object('id', v_student.id, 'full_name', v_student.full_name, 'matric_number', v_student.matric_number),
      'scanned_at', v_existing.scanned_at
    );
  end if;

  begin
    insert into public.notifications (institution_id, user_id, title, body, type, link)
    values (
      v_session.institution_id, v_student.id,
      'Attendance recorded',
      format('%s — %s', v_course.code, v_session.title),
      'attendance', '/student/attendance'
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'code', 'SUCCESS',
    'duplicate', false,
    'message', 'Attendance recorded.',
    'student', jsonb_build_object('id', v_student.id, 'full_name', v_student.full_name, 'matric_number', v_student.matric_number),
    'course', jsonb_build_object('id', v_course.id, 'code', v_course.code, 'title', v_course.title),
    'session', jsonb_build_object('id', v_session.id, 'title', v_session.title),
    'attendance_status', v_status,
    'scanned_at', v_record.scanned_at,
    'sync_source', v_record.sync_source
  );
end;
$$;

create or replace function public.sync_attendance_batch(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', false, 'message', 'Expected an array of attendance items.');
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_result := public.record_attendance(
        (v_item ->> 'attendance_session_id')::uuid,
        v_item ->> 'qr_token',
        nullif(v_item ->> 'client_transaction_id', '')::uuid,
        nullif(v_item ->> 'local_scanned_at', '')::timestamptz,
        v_item ->> 'device_info'
      );
      v_result := v_result || jsonb_build_object('client_transaction_id', v_item ->> 'client_transaction_id');
    exception when others then
      v_result := jsonb_build_object(
        'ok', false,
        'code', 'ERROR',
        'message', sqlerrm,
        'client_transaction_id', v_item ->> 'client_transaction_id'
      );
    end;
    v_results := v_results || jsonb_build_array(v_result);
  end loop;

  return jsonb_build_object('ok', true, 'results', v_results);
end;
$$;

create or replace function public.correct_attendance(
  p_record_id uuid,
  p_status public.attendance_status,
  p_reason text
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record public.attendance_records%rowtype;
  v_before jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_record from public.attendance_records where id = p_record_id;
  if not found then
    raise exception 'Attendance record not found';
  end if;

  if not (
    public.is_super_admin()
    or public.is_institution_admin(v_record.institution_id)
    or (public.current_app_role() = 'lecturer'
        and exists (
          select 1 from public.attendance_sessions s
          where s.id = v_record.attendance_session_id and s.lecturer_id = auth.uid()
        ))
  ) then
    raise exception 'Not authorized to correct this record';
  end if;

  v_before := to_jsonb(v_record);

  update public.attendance_records
  set status = p_status, method = 'correction'
  where id = p_record_id
  returning * into v_record;

  insert into public.attendance_audit_logs (
    institution_id, attendance_record_id, actor_id, action, previous_state, new_state, reason
  ) values (
    v_record.institution_id, v_record.id, auth.uid(), 'attendance_correction',
    v_before, to_jsonb(v_record), p_reason
  );

  return v_record;
end;
$$;

create or replace function public.ensure_student_qr(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student public.profiles%rowtype;
  v_token text;
begin
  select * into v_student from public.profiles where id = p_student_id;
  if not found then
    raise exception 'Student not found';
  end if;

  if not (public.is_super_admin() or public.is_institution_admin(v_student.institution_id)) then
    raise exception 'Not authorized to manage QR credentials';
  end if;

  select token into v_token from public.student_qr_credentials
  where student_id = p_student_id and status = 'active';
  if found then
    return v_token;
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.student_qr_credentials (institution_id, student_id, token)
  values (v_student.institution_id, p_student_id, v_token)
  on conflict do nothing;

  select token into v_token from public.student_qr_credentials
  where student_id = p_student_id and status = 'active';
  return v_token;
end;
$$;

create or replace function public.regenerate_student_qr(p_student_id uuid, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student public.profiles%rowtype;
  v_token text := encode(gen_random_bytes(24), 'hex');
begin
  select * into v_student from public.profiles where id = p_student_id;
  if not found then
    raise exception 'Student not found';
  end if;

  if not (public.is_super_admin() or public.is_institution_admin(v_student.institution_id)) then
    raise exception 'Not authorized to manage QR credentials';
  end if;

  update public.student_qr_credentials
  set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
  where student_id = p_student_id and status = 'active';

  insert into public.student_qr_credentials (institution_id, student_id, token)
  values (v_student.institution_id, p_student_id, v_token);

  begin
    insert into public.audit_logs (institution_id, actor_id, action, entity_type, entity_id, metadata)
    values (v_student.institution_id, auth.uid(), 'student_qr_regenerated', 'profile', p_student_id::text,
            jsonb_build_object('reason', p_reason));
  exception when others then
    null;
  end;

  return v_token;
end;
$$;

create or replace function public.open_attendance_session(p_session_id uuid, p_action text default 'open')
returns public.attendance_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_role public.app_role;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;

  v_role := public.current_app_role();

  if not (
    public.is_super_admin()
    or public.is_institution_admin(v_session.institution_id)
    or (v_role = 'lecturer' and v_session.lecturer_id = auth.uid())
  ) then
    raise exception 'Not authorized';
  end if;

  if p_action = 'open' then
    update public.attendance_sessions
    set status = 'open', opened_at = coalesce(opened_at, now()), closed_at = null
    where id = p_session_id returning * into v_session;
  elsif p_action = 'pause' then
    update public.attendance_sessions
    set status = 'paused'
    where id = p_session_id and status = 'open' returning * into v_session;
  elsif p_action = 'resume' then
    update public.attendance_sessions
    set status = 'open'
    where id = p_session_id and status = 'paused' returning * into v_session;
  elsif p_action = 'close' then
    update public.attendance_sessions
    set status = 'closed', closed_at = now()
    where id = p_session_id returning * into v_session;
  elsif p_action = 'cancel' then
    update public.attendance_sessions
    set status = 'cancelled', closed_at = now()
    where id = p_session_id returning * into v_session;
  else
    raise exception 'Unknown action %', p_action;
  end if;

  if v_session.id is null then
    raise exception 'Action % is not valid for current session status', p_action;
  end if;

  return v_session;
end;
$$;

create or replace function public.close_expired_sessions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_closed integer := 0;
begin
  with closed as (
    update public.attendance_sessions
    set status = 'closed', closed_at = now()
    where status in ('open', 'paused') and closes_at <= now()
    returning 1
  )
  select count(*) into v_closed from closed;

  update public.attendance_sessions
  set status = 'open', opened_at = coalesce(opened_at, now())
  where status = 'scheduled' and opens_at <= now() and closes_at > now();

  return v_closed;
end;
$$;

create or replace function public.get_session_roster(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_roster jsonb;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;

  if not (
    public.is_super_admin()
    or public.is_institution_admin(v_session.institution_id)
    or (public.current_app_role() = 'lecturer' and v_session.lecturer_id = auth.uid())
  ) then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.full_name), '[]'::jsonb)
  into v_roster
  from (
    select
      cr.student_id,
      p.full_name,
      p.matric_number,
      cr.status as registration_status,
      (ar.id is not null) as present,
      ar.scanned_at,
      ar.status as attendance_status
    from public.course_registrations cr
    join public.profiles p on p.id = cr.student_id
    left join public.attendance_records ar
      on ar.attendance_session_id = p_session_id and ar.student_id = cr.student_id
    where cr.course_id = v_session.course_id and cr.status = 'registered'
  ) r;

  return jsonb_build_object('session', row_to_json(v_session), 'roster', v_roster);
end;
$$;

-- ---------------------------------------------------------------------
-- Read models (security_invoker so tenant RLS still applies)
-- ---------------------------------------------------------------------
create or replace view public.student_course_attendance
with (security_invoker = true) as
select
  cr.institution_id,
  cr.student_id,
  c.id as course_id,
  c.code as course_code,
  c.title as course_title,
  count(distinct s.id) filter (where s.status in ('open', 'closed')) as classes_held,
  count(distinct r.id) filter (where r.status in ('present', 'late', 'excused')) as attended,
  count(distinct r.id) filter (where r.status = 'late') as late_count
from public.course_registrations cr
join public.courses c on c.id = cr.course_id
left join public.attendance_sessions s
  on s.course_id = c.id and s.status in ('open', 'closed')
left join public.attendance_records r
  on r.attendance_session_id = s.id and r.student_id = cr.student_id
where cr.status = 'registered'
group by cr.institution_id, cr.student_id, c.id, c.code, c.title;

create or replace view public.session_attendance_summary
with (security_invoker = true) as
select
  s.id as session_id,
  s.institution_id,
  s.course_id,
  s.lecturer_id,
  (select count(*) from public.course_registrations cr
     where cr.course_id = s.course_id and cr.status = 'registered') as registered_count,
  count(r.id) filter (where r.status in ('present', 'late', 'excused')) as present_count
from public.attendance_sessions s
left join public.attendance_records r on r.attendance_session_id = s.id
group by s.id, s.institution_id, s.course_id, s.lecturer_id;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.institutions enable row level security;
alter table public.institution_settings enable row level security;
alter table public.faculties enable row level security;
alter table public.departments enable row level security;
alter table public.campuses enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.semesters enable row level security;
alter table public.courses enable row level security;
alter table public.course_lecturers enable row level security;
alter table public.course_registrations enable row level security;
alter table public.student_qr_credentials enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_audit_logs enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_usage enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.notifications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;

-- institutions
create policy "institutions_select_member" on public.institutions
  for select using (public.is_super_admin() or public.belongs_to_institution(id));
create policy "institutions_super_all" on public.institutions
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "institutions_admin_update" on public.institutions
  for update using (public.is_institution_admin(id))
  with check (public.is_institution_admin(id));

-- institution_settings
create policy "settings_select_member" on public.institution_settings
  for select using (public.is_super_admin() or public.belongs_to_institution(institution_id));
create policy "settings_super_all" on public.institution_settings
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "settings_admin_write" on public.institution_settings
  for all using (public.is_institution_admin(institution_id))
  with check (public.is_institution_admin(institution_id));

-- profiles
create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_staff_select" on public.profiles
  for select using (
    public.is_super_admin()
    or (public.belongs_to_institution(institution_id)
        and public.current_app_role() in ('institution_admin', 'lecturer'))
    or (public.current_app_role() = 'student'
        and exists (
          select 1 from public.user_roles ur
          where ur.user_id = public.profiles.id
            and ur.role = 'lecturer'
            and ur.institution_id = public.profiles.institution_id
        ))
  );
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_write" on public.profiles
  for all using (
    public.is_super_admin()
    or public.is_institution_admin(institution_id)
  )
  with check (
    public.is_super_admin()
    or public.is_institution_admin(institution_id)
  );

-- user_roles
create policy "roles_select_self" on public.user_roles
  for select using (user_id = auth.uid() or public.is_super_admin()
    or (public.is_institution_admin(institution_id) and institution_id = public.current_institution_id()));

-- Academic structure: members read, admins write.
do $$
declare
  t text;
begin
  foreach t in array array[
    'faculties', 'departments', 'campuses', 'academic_sessions',
    'semesters', 'courses', 'course_lecturers'
  ]
  loop
    execute format(
      'create policy "%s_select_member" on public.%I for select using (public.is_super_admin() or public.belongs_to_institution(institution_id))',
      t, t
    );
    execute format(
      'create policy "%s_write_admin" on public.%I for all using (public.is_super_admin() or public.is_institution_admin(institution_id)) with check (public.is_super_admin() or public.is_institution_admin(institution_id))',
      t, t
    );
  end loop;
end
$$;

-- course_registrations
create policy "registrations_select" on public.course_registrations
  for select using (
    public.is_super_admin()
    or public.is_institution_admin(institution_id)
    or (public.current_app_role() = 'lecturer' and public.is_lecturer_assigned(course_id))
    or student_id = auth.uid()
  );
create policy "registrations_write_admin" on public.course_registrations
  for all using (public.is_super_admin() or public.is_institution_admin(institution_id))
  with check (public.is_super_admin() or public.is_institution_admin(institution_id));

-- student_qr_credentials (students can read their own; staff read institution-scoped)
create policy "qr_select" on public.student_qr_credentials
  for select using (
    student_id = auth.uid()
    or public.is_super_admin()
    or public.is_institution_admin(institution_id)
  );
create policy "qr_admin_write" on public.student_qr_credentials
  for all using (public.is_super_admin() or public.is_institution_admin(institution_id))
  with check (public.is_super_admin() or public.is_institution_admin(institution_id));

-- attendance_sessions
create policy "sessions_select" on public.attendance_sessions
  for select using (
    public.is_super_admin()
    or public.is_institution_admin(institution_id)
    or (public.current_app_role() = 'lecturer' and lecturer_id = auth.uid())
    or (public.current_app_role() = 'student' and public.is_registered_for_course(course_id))
  );
create policy "sessions_write_admin" on public.attendance_sessions
  for all using (public.is_super_admin() or public.is_institution_admin(institution_id))
  with check (public.is_super_admin() or public.is_institution_admin(institution_id));
create policy "sessions_insert_lecturer" on public.attendance_sessions
  for insert with check (
    public.current_app_role() = 'lecturer'
    and lecturer_id = auth.uid()
    and public.belongs_to_institution(institution_id)
    and public.is_lecturer_assigned(course_id)
  );
create policy "sessions_update_lecturer" on public.attendance_sessions
  for update using (public.current_app_role() = 'lecturer' and lecturer_id = auth.uid())
  with check (public.current_app_role() = 'lecturer' and lecturer_id = auth.uid());
create policy "sessions_delete_lecturer" on public.attendance_sessions
  for delete using (public.current_app_role() = 'lecturer' and lecturer_id = auth.uid() and status in ('scheduled', 'cancelled'));

-- attendance_records: inserts only through record_attendance()
create policy "records_select" on public.attendance_records
  for select using (
    public.is_super_admin()
    or public.is_institution_admin(institution_id)
    or (public.current_app_role() = 'lecturer'
        and exists (
          select 1 from public.attendance_sessions s
          where s.id = attendance_records.attendance_session_id
            and s.lecturer_id = auth.uid()
        ))
    or student_id = auth.uid()
  );
create policy "records_update_admin" on public.attendance_records
  for update using (public.is_super_admin() or public.is_institution_admin(institution_id))
  with check (public.is_super_admin() or public.is_institution_admin(institution_id));

create policy "audit_select" on public.attendance_audit_logs
  for select using (
    public.is_super_admin()
    or public.is_institution_admin(institution_id)
    or (public.current_app_role() = 'lecturer'
        and exists (
          select 1 from public.attendance_records ar
          join public.attendance_sessions s on s.id = ar.attendance_session_id
          where ar.id = attendance_audit_logs.attendance_record_id and s.lecturer_id = auth.uid()
        ))
  );

-- subscription plans
create policy "plans_select_active" on public.subscription_plans
  for select using (is_active or public.is_super_admin());
create policy "plans_super_write" on public.subscription_plans
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- subscriptions + usage
create policy "subscriptions_select" on public.subscriptions
  for select using (public.is_super_admin() or public.is_institution_admin(institution_id));
create policy "subscriptions_super_write" on public.subscriptions
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "usage_select" on public.subscription_usage
  for select using (public.is_super_admin() or public.is_institution_admin(institution_id));
create policy "usage_super_write" on public.subscription_usage
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- payments
create policy "payments_select" on public.payments
  for select using (public.is_super_admin() or public.is_institution_admin(institution_id));
create policy "payments_super_write" on public.payments
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "webhook_events_select" on public.payment_webhook_events
  for select using (public.is_super_admin());

-- notifications
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid() or public.is_super_admin());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_staff_insert" on public.notifications
  for insert with check (
    public.is_super_admin()
    or (public.belongs_to_institution(institution_id)
        and public.current_app_role() in ('institution_admin', 'lecturer'))
  );

-- support tickets
create policy "tickets_select" on public.support_tickets
  for select using (
    public.is_super_admin()
    or (public.is_institution_admin(institution_id) and institution_id = public.current_institution_id())
  );
create policy "tickets_insert" on public.support_tickets
  for insert with check (
    public.is_super_admin()
    or (public.is_institution_admin(institution_id) and institution_id = public.current_institution_id())
  );
create policy "tickets_super_update" on public.support_tickets
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- platform settings & audit logs
create policy "platform_settings_super" on public.platform_settings
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "audit_logs_select" on public.audit_logs
  for select using (
    public.is_super_admin()
    or (public.is_institution_admin(institution_id) and institution_id = public.current_institution_id())
  );

-- ---------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------
grant execute on function public.record_attendance(uuid, text, uuid, timestamptz, text) to authenticated;
grant execute on function public.sync_attendance_batch(jsonb) to authenticated;
grant execute on function public.correct_attendance(uuid, public.attendance_status, text) to authenticated;
grant execute on function public.ensure_student_qr(uuid) to authenticated;
grant execute on function public.regenerate_student_qr(uuid, text) to authenticated;
grant execute on function public.open_attendance_session(uuid, text) to authenticated;
grant execute on function public.get_session_roster(uuid) to authenticated;
grant execute on function public.close_expired_sessions() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.attendance_records;
exception when duplicate_object then null;
          when undefined_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.attendance_sessions;
exception when duplicate_object then null;
          when undefined_object then null;
end
$$;

-- Scheduled housekeeping (Supabase supports pg_cron; ignore if unavailable)
do $$
begin
  perform cron.schedule(
    'close-expired-attendance-sessions',
    '* * * * *',
    'select public.close_expired_sessions();'
  );
exception when others then
  raise notice 'pg_cron schedule skipped: %', sqlerrm;
end
$$;
