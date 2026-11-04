-- ---------------------------------------------------------------------
-- Lecturer attendance scope hardening
--
-- record_attendance already verifies that the lecturer is assigned to the
-- session's course before accepting a scan. These replacements add the same
-- check to the other session entry points so an assignment removed after a
-- session was created cannot be used to open, correct or enumerate it.
-- ---------------------------------------------------------------------

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

  if v_role = 'lecturer' and not public.is_lecturer_assigned(v_session.course_id) then
    raise exception 'You are not assigned to this course';
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

  if public.current_app_role() = 'lecturer'
     and not public.is_lecturer_assigned(
       (select s.course_id from public.attendance_sessions s where s.id = v_record.attendance_session_id)
     ) then
    raise exception 'You are not assigned to the course for this record';
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

  if public.current_app_role() = 'lecturer' and not public.is_lecturer_assigned(v_session.course_id) then
    raise exception 'You are not assigned to this course';
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

-- Defense in depth: direct table writes must also require a current assignment.
drop policy if exists "sessions_update_lecturer" on public.attendance_sessions;
create policy "sessions_update_lecturer" on public.attendance_sessions
  for update
  using (
    public.current_app_role() = 'lecturer'
    and lecturer_id = auth.uid()
    and public.is_lecturer_assigned(course_id)
  )
  with check (
    public.current_app_role() = 'lecturer'
    and lecturer_id = auth.uid()
    and public.is_lecturer_assigned(course_id)
  );

drop policy if exists "sessions_delete_lecturer" on public.attendance_sessions;
create policy "sessions_delete_lecturer" on public.attendance_sessions
  for delete
  using (
    public.current_app_role() = 'lecturer'
    and lecturer_id = auth.uid()
    and public.is_lecturer_assigned(course_id)
    and status in ('scheduled', 'cancelled')
  );
