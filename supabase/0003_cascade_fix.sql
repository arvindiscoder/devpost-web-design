-- =============================================================================
-- ClientSync - 0003 cascade-delete + trigger-fix
--
-- FIXES:
-- 1) Auth-user cascades: only enforce the portal guard on PostgREST calls
--    (requests carrying request.jwt.claims). Internal SQL, migrations and
--    Supabase's auth-user deletion cascade pass through untouched.
-- 2) A BEFORE DELETE trigger must RETURN OLD. Returning NEW for a DELETE
--    makes the row survive, which is why deletes reported HTTP 200 while
--    removing nothing and left orphan deliverables behind.
-- =============================================================================

create or replace function public.guard_portal_deliverable_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Not a PostgREST request (SQL editor, migration, auth cascade).
  if current_setting('request.jwt.claims', true) is null
     and current_setting('request.jwt.claim.role', true) is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Trusted callers: the agency (authenticated) and service_role.
  if public.caller_role() <> 'anon' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Portal client (anon) path.
  if tg_op = 'DELETE' then
    raise exception 'Portal clients cannot delete deliverables.'
      using errcode = '42501';
  end if;

  if new.client_id     is distinct from old.client_id
  or new.title         is distinct from old.title
  or new.description   is distinct from old.description
  or new.file_url      is distinct from old.file_url
  or new.file_path     is distinct from old.file_path
  or new.file_name     is distinct from old.file_name
  or new.file_size     is distinct from old.file_size
  or new.file_type     is distinct from old.file_type
  or new.created_at    is distinct from old.created_at
  or new.due_date      is distinct from old.due_date
  or new.revision      is distinct from old.revision
  or new.feedback_at   is distinct from old.feedback_at
  or new.approved_at   is distinct from old.approved_at
  then
    raise exception 'Portal clients cannot modify deliverable metadata.'
      using errcode = '42501';
  end if;

  if new.status = 'pending_review' and old.status is distinct from new.status then
    new.client_feedback := null;
    new.feedback_at     := null;
  end if;

  if new.status = 'approved' and old.status <> 'approved' then
    if old.status <> 'pending_review' then
      raise exception 'Only deliverables pending review can be approved.'
        using errcode = '42501';
    end if;
    new.approved_at := timezone('utc', now());
  end if;

  if old.status = 'approved' and new.status <> 'approved' then
    new.approved_at := null;
  end if;

  return new;
end;
$$;

do $$ begin
  raise notice '0003 applied: DELETE returns OLD; guard only covers PostgREST traffic.';
end $$;