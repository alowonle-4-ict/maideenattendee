-- Provisioning and migrations legitimately set tenant-managed profile fields
-- through the service role. The JWT role claim is the reliable signal because
-- auth.uid() is null for service-role requests.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or coalesce(
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
          ''
        ) = 'service_role' then
    return new;
  end if;

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
