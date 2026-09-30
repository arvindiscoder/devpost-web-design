-- =============================================================================
-- ClientSync — 0002 security fix
--
-- Two real holes found by the end-to-end test against a live project:
--
-- 1. DRAFT LEAK. The portal RLS policies scoped rows by access token but not
--    by status, so anyone holding a portal link could enumerate every internal
--    draft by id. The server action filtered them, but RLS is the boundary.
--
-- 2. COLUMN GUARD NEVER FIRED. guard_portal_deliverable_write() decided whether
--    the caller was the portal with:
--        nullif(current_setting('request.jwt.claim.role', true), '')
--        -> nullif(current_setting('role', true), '')
--    Two mistakes compounded:
--      a) modern PostgREST sets only `request.jwt.claims` (jsonb), so the first
--         branch is always NULL here;
--      b) the fallback read the `role` GUC from inside a SECURITY DEFINER
--         function, where PostgreSQL has already switched the role to the
--         function OWNER. It reported 'postgres', not 'anon'.
--    Result: the guard returned `new` on every portal write, so a leaked link
--    could rewrite titles, swap file_url, forge approved_at and bump revision.
--    The RLS policies were unaffected because they are language sql (invoker)
--    and read the role outside any definer context — which is why reads looked
--    correct while writes were wide open.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

-- 1. Read the role from the JWT, never from the `role` GUC ------------------
create or replace function public.caller_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    ),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    'anon'
  );
$$;

-- 2. The guard needs no elevated rights; invoker keeps the caller's role ----
create or replace function public.guard_portal_deliverable_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.caller_role() <> 'anon' then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;                                       -- agency / service_role: trusted
  end if;

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

-- 3. Never expose drafts to a portal token ----------------------------------
drop policy if exists "portal clients read their deliverables" on public.deliverables;
create policy "portal clients read their deliverables"
  on public.deliverables
  for select
  to anon, authenticated
  using (
    public.caller_role() = 'anon'
    and deliverables.status <> 'draft'
    and exists (
      select 1 from public.clients c
      where c.id = deliverables.client_id
        and c.access_token = public.portal_token()
        and c.revoked_at is null
    )
  );

drop policy if exists "portal clients action their deliverables" on public.deliverables;
create policy "portal clients action their deliverables"
  on public.deliverables
  for update
  to anon, authenticated
  using (
    public.caller_role() = 'anon'
    and deliverables.status <> 'draft'
    and exists (
      select 1 from public.clients c
      where c.id = deliverables.client_id
        and c.access_token = public.portal_token()
        and c.revoked_at is null
    )
  )
  with check (
    public.caller_role() = 'anon'
    and deliverables.status <> 'draft'
    and exists (
      select 1 from public.clients c
      where c.id = deliverables.client_id
        and c.access_token = public.portal_token()
        and c.revoked_at is null
    )
  );

-- -----------------------------------------------------------------------------
-- Verify. Expect: caller_role = anon, guard = invoker, 0 drafts visible.
-- -----------------------------------------------------------------------------
do $$
declare
  v_role text;
  v_def  text;
  v_leak int;
begin
  select public.caller_role() into v_role;
  select p.prosecdef::text into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'guard_portal_deliverable_write';

  select count(*) into v_leak
  from pg_policies
  where schemaname = 'public' and tablename = 'deliverables'
    and policyname like 'portal%'
    and qual is not null and qual not like '%draft%';

  raise notice '0002 applied. caller_role sees: % | guard security_definer: % | portal policies missing draft filter: %',
    v_role, v_def, v_leak;

  if v_leak > 0 then
    raise exception '0002 incomplete: a portal policy still omits the draft filter.';
  end if;
end $$;
