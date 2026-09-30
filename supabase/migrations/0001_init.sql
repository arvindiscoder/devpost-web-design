-- =============================================================================
-- ClientSync — 0001_init.sql
-- Zero-cost passwordless client portal platform for freelancers and agencies.
--
-- HOW TO RUN
--   Option A (recommended):  Supabase Dashboard -> SQL Editor -> paste -> Run
--   Option B (CLI):          npx supabase link --project-ref <ref>
--                           npx supabase db push
--
-- The script is idempotent: it can be re-run safely on an existing project.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.deliverable_status as enum (
    'draft',            -- internally visible only, never sent to the client
    'pending_review',   -- pushed to the client portal, awaiting a decision
    'changes_requested',-- client asked for revisions
    'approved'          -- client signed off (terminal state)
  );
exception
  when duplicate_object then null;   -- already exists -> no-op
end $$;

do $$ begin
  create type public.signoff_method as enum ('typed_name', 'checkbox', 'initials');
exception
  when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- 2.1 workspaces -------------------------------------------------------------
-- A workspace isolates one agency (or solo freelancer) and everything under it.
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  name        text        not null check (char_length(trim(name)) between 2 and 80),
  owner_id    uuid        not null references auth.users (id) on delete cascade,
  -- Branding surfaced on the client-facing portal.
  logo_url    text,
  accent_color text       default '#4f46e5',
  -- Free-tier guard rails (see README "Theoretical Fiscal Architecture").
  plan        text        not null default 'free'
                          check (plan in ('free', 'pro', 'agency')),
  -- Trial bookkeeping, kept server-side so it can never be edited by a client.
  trial_ends_at timestamptz
);

-- 2.2 clients ----------------------------------------------------------------
-- A client never authenticates. `access_token` is the bearer credential that
-- unlocks /portal/<access_token>, so it is a uuid v4 (122 bits of entropy).
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  workspace_id  uuid        not null references public.workspaces (id) on delete cascade,
  name          text        not null check (char_length(trim(name)) between 1 and 120),
  email         text        not null check (position('@' in email) > 1),
  company       text,
  project_title text,
  access_token  uuid        not null unique default gen_random_uuid(),
  -- Token lifecycle: set revoked_at to kill every outstanding magic link at once.
  revoked_at    timestamptz,
  last_seen_at  timestamptz
);

-- 2.3 deliverables -----------------------------------------------------------
create table if not exists public.deliverables (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),
  client_id       uuid        not null references public.clients (id) on delete cascade,
  title           text        not null check (char_length(trim(title)) between 1 and 160),
  description     text,
  -- file_url is the public CDN URL of the object in `deliverables_bucket`;
  -- file_path is the storage object key (needed to delete/replace the object).
  file_url        text,
  file_path       text,
  file_name       text,
  file_size       bigint check (file_size is null or file_size >= 0),
  file_type       text,
  status          public.deliverable_status not null default 'draft',
  client_feedback text,
  feedback_at     timestamptz,
  revision        integer     not null default 1 check (revision >= 1),
  due_date        date,
  approved_at     timestamptz
);

-- 2.4 signoffs ---------------------------------------------------------------
-- Append-only digital sign-off ledger. One row per approval event, so a
-- re-opened deliverable keeps its full audit history.
create table if not exists public.signoffs (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default timezone('utc', now()),
  deliverable_id uuid        not null references public.deliverables (id) on delete cascade,
  client_id      uuid        not null references public.clients (id)      on delete cascade,
  workspace_id   uuid        not null references public.workspaces (id)   on delete cascade,
  -- Legal name the client typed into the sign-off box.
  signer_name    text        not null check (char_length(trim(signer_name)) between 2 and 120),
  signer_email   text        not null,
  method         public.signoff_method not null default 'typed_name',
  ip_address     inet,
  user_agent     text,
  notes          text
);

-- -----------------------------------------------------------------------------
-- 3. Indexes
-- -----------------------------------------------------------------------------
-- The portal resolves a request by token on every page load, so uniqueness is
-- a correctness property here, not just an index. The inline `unique` on the
-- column covers fresh installs; this block back-fills it on a re-run.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clients'::regclass
      and conname  = 'clients_access_token_key'
  ) then
    alter table public.clients
      add constraint clients_access_token_key unique (access_token);
  end if;
end;
$$;

create index if not exists workspaces_owner_id_idx        on public.workspaces   (owner_id);
create index if not exists workspaces_owner_created_idx  on public.workspaces   (owner_id, created_at desc);

create index if not exists clients_workspace_id_idx      on public.clients       (workspace_id);
create index if not exists clients_access_token_idx      on public.clients       (access_token);
create index if not exists clients_workspace_active_idx  on public.clients       (workspace_id, created_at desc)
  where revoked_at is null;
create index if not exists clients_email_lower_idx       on public.clients       (lower(email));

create index if not exists deliverables_client_id_idx    on public.deliverables (client_id);
create index if not exists deliverables_status_idx       on public.deliverables (status);
create index if not exists deliverables_client_created_idx on public.deliverables (client_id, created_at desc);
create index if not exists deliverables_pending_idx     on public.deliverables (client_id, created_at desc)
  where status = 'pending_review';

create index if not exists signoffs_deliverable_id_idx   on public.signoffs      (deliverable_id);
create index if not exists signoffs_workspace_created_idx on public.signoffs     (workspace_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 4. updated_at triggers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists workspaces_set_updated_at   on public.workspaces;
create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at      on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists deliverables_set_updated_at on public.deliverables;
create trigger deliverables_set_updated_at
  before update on public.deliverables
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Security-definer helpers used by RLS policies
--    - SECURITY DEFINER lets policies read other tables without recursing into
--      their own RLS (which would otherwise infinitely recurse).
--    - search_path is pinned to prevent function-hijacking.
-- -----------------------------------------------------------------------------

-- 5.1 Does the currently authenticated user own this workspace?
create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = p_workspace_id
      and w.owner_id = auth.uid()
  );
$$;

-- 5.2 Does the currently authenticated user own the workspace this client is in?
create or replace function public.is_client_owner(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clients c
    join public.workspaces w on w.id = c.workspace_id
    where c.id = p_client_id
      and w.owner_id = auth.uid()
  );
$$;

-- 5.3 The JWT role of the caller ('anon' | 'authenticated' | 'service_role').
--     MUST be read from the JWT claim, never from the `role` GUC: inside a
--     SECURITY DEFINER function PostgreSQL switches the role to the function
--     owner, so `current_setting('role')` would report the owner and every
--     "is this an anon portal call?" check would silently pass.
--     Modern PostgREST exposes the claims as `request.jwt.claims` (jsonb); the
--     singular `request.jwt.claim.role` is kept only for older installs.
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

-- 5.4 The bearer token supplied by the passwordless portal.
--     The Next.js server injects it as the `x-portal-token` request header.
--     Returns NULL (never raises) so a malformed header cannot be used to
--     enumerate rows — the cast is guarded by a uuid regex.
create or replace function public.portal_token()
returns uuid
language sql
stable
as $$
  select nullif(
    (regexp_match(
       coalesce(current_setting('request.headers', true)::jsonb ->> 'x-portal-token', ''),
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     ))[1],
  '')::uuid;
$$;

-- 5.5 True when `p_token` unlocks the client row (and the link is not revoked).
create or replace function public.is_valid_portal_token(p_token uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.access_token = p_token
      and c.revoked_at is null
  );
$$;

-- -----------------------------------------------------------------------------
-- 6. Column guard: portal callers (anon) may only move status / feedback fields.
--    RLS cannot restrict *columns*, so a trigger enforces the write surface:
--    a leaked link must not let anyone rewrite titles, swap files, or re-point
--    a deliverable at a different client.
-- -----------------------------------------------------------------------------
create or replace function public.guard_portal_deliverable_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Only PostgREST requests carry JWT claims. Everything else -- Supabase's
  -- auth-user deletion (cascades workspaces -> clients -> deliverables),
  -- the SQL editor, migrations -- must pass through untouched.
  if current_setting('request.jwt.claims', true) is null
     and current_setting('request.jwt.claim.role', true) is null then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if public.caller_role() <> 'anon' then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Portal clients cannot delete deliverables.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
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
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists deliverables_guard_portal_write on public.deliverables;
create trigger deliverables_guard_portal_write
  before update or delete on public.deliverables
  for each row execute function public.guard_portal_deliverable_write();

-- Keep `last_seen_at` cheap for analytics; called from the server action.
create or replace function public.touch_client(p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.clients
     set last_seen_at = timezone('utc', now())
   where access_token = p_token
     and revoked_at is null;
$$;

-- -----------------------------------------------------------------------------
-- 7. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.workspaces   enable row level security;
alter table public.clients      enable row level security;
alter table public.deliverables enable row level security;
alter table public.signoffs     enable row level security;

-- Force RLS even for the table owner (defence in depth for the SQL editor).
do $$
declare t text;
begin
  foreach t in array array['workspaces','clients','deliverables','signoffs'] loop
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- 7.1 workspaces -------------------------------------------------------------
drop policy if exists "owners manage their workspaces" on public.workspaces;
create policy "owners manage their workspaces"
  on public.workspaces
  for all
  to authenticated
  using      (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 7.2 clients ----------------------------------------------------------------
drop policy if exists "owners manage their clients" on public.clients;
create policy "owners manage their clients"
  on public.clients
  for all
  to authenticated
  using      (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- Passwordless portal: read-only access to the client row that owns the token.
drop policy if exists "portal clients read their own record" on public.clients;
create policy "portal clients read their own record"
  on public.clients
  for select
  to anon, authenticated
  using (
    public.caller_role() = 'anon'
    and access_token = public.portal_token()
    and revoked_at is null
  );

-- 7.3 deliverables -----------------------------------------------------------
drop policy if exists "owners manage their deliverables" on public.deliverables;
create policy "owners manage their deliverables"
  on public.deliverables
  for all
  to authenticated
  using      (public.is_client_owner(client_id))
  with check (public.is_client_owner(client_id));

-- Passwordless portal: read the deliverable list + record the decision.
-- `status <> 'draft'` is the load-bearing clause: without it a portal token
-- could enumerate every internal draft by id. The server action filters too,
-- but RLS is the boundary that actually holds.
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
-- (the column surface is narrowed by guard_portal_deliverable_write above)

-- 7.4 signoffs ---------------------------------------------------------------
-- A client may read their own sign-offs; the agency may read all of theirs.
-- Writes always go through the server action using the service role.
drop policy if exists "owners read their signoffs" on public.signoffs;
create policy "owners read their signoffs"
  on public.signoffs
  for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

drop policy if exists "portal clients read their signoffs" on public.signoffs;
create policy "portal clients read their signoffs"
  on public.signoffs
  for select
  to anon, authenticated
  using (
    public.caller_role() = 'anon'
    and exists (
      select 1 from public.clients c
      where c.id = signoffs.client_id
        and c.access_token = public.portal_token()
        and c.revoked_at is null
    )
  );

-- -----------------------------------------------------------------------------
-- 8. Storage — `deliverables_bucket` (public read, authenticated write)
--    Object key convention:  <workspace_id>/<client_id>/<deliverable_id>-<filename>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deliverables_bucket',
  'deliverables_bucket',
  true,            -- public read: clients download via CDN with no auth round-trip
  52428800,        -- 50 MB per file (comfortably inside the 1 GB free-tier pool)
  array[
    'application/pdf','image/png','image/jpeg','image/gif','image/webp','image/svg+xml',
    'application/zip','application/x-zip-compressed','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4','video/quicktime','audio/mpeg','audio/wav','text/plain','text/markdown',
    'application/octet-stream'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Helper: first path segment of an object name == workspace id.
-- A `language sql` function cannot carry an EXCEPTION block, so the uuid cast
-- is guarded by a regex instead. That keeps this function total: it returns
-- NULL for a malformed key instead of raising, so a bad object name can never
-- turn a storage policy into a 500.
create or replace function public.storage_object_workspace(object_name text)
returns uuid
language sql
immutable
as $$
  select case
           when object_name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
             then split_part(object_name, '/', 1)::uuid
           else null
         end;
$$;

-- Public read (the bucket is public; this makes the intent explicit).
drop policy if exists "public read deliverables" on storage.objects;
create policy "public read deliverables"
  on storage.objects
  for select
  to public
  using (bucket_id = 'deliverables_bucket');

-- Agency writes: only into a workspace the signed-in user owns.
drop policy if exists "owners upload deliverables" on storage.objects;
create policy "owners upload deliverables"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'deliverables_bucket'
    and public.is_workspace_owner(public.storage_object_workspace(name))
  );

drop policy if exists "owners update deliverables" on storage.objects;
create policy "owners update deliverables"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'deliverables_bucket'
    and public.is_workspace_owner(public.storage_object_workspace(name))
  )
  with check (
    bucket_id = 'deliverables_bucket'
    and public.is_workspace_owner(public.storage_object_workspace(name))
  );

drop policy if exists "owners delete deliverables" on storage.objects;
create policy "owners delete deliverables"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'deliverables_bucket'
    and public.is_workspace_owner(public.storage_object_workspace(name))
  );

-- -----------------------------------------------------------------------------
-- 9. Realtime — powers the live approval badges in the dashboard and portal.
--    REPLICA IDENTITY FULL makes UPDATE payloads include the changed columns.
-- -----------------------------------------------------------------------------
alter table public.deliverables replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deliverables'
  ) then
    alter publication supabase_realtime add table public.deliverables;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'signoffs'
  ) then
    alter publication supabase_realtime add table public.signoffs;
  end if;
exception
  when others then
    -- Publication may not exist on every project shape; realtime is an
    -- enhancement, not a requirement, so never fail the migration for it.
    raise notice 'Realtime publication skipped: %', sqlerrm;
end $$;

-- -----------------------------------------------------------------------------
-- 10. Bootstrap RPC — "create workspace + first client" in one atomic call.
--     Declared SECURITY DEFINER so it can insert into clients on behalf of a
--     caller that only has the `authenticated` role.
-- -----------------------------------------------------------------------------
create or replace function public.bootstrap_workspace(
  p_workspace_name text,
  p_client_name    text default null,
  p_client_email   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner    uuid := auth.uid();
  v_workspace uuid;
  v_client   uuid;
begin
  if v_owner is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  -- Reuse the user's first workspace instead of littering the account.
  select id into v_workspace
  from public.workspaces
  where owner_id = v_owner
  order by created_at asc
  limit 1;

  if v_workspace is null then
    insert into public.workspaces (name, owner_id, trial_ends_at)
    values (p_workspace_name, v_owner, timezone('utc', now()) + interval '14 days')
    returning id into v_workspace;
  else
    update public.workspaces set name = p_workspace_name where id = v_workspace;
  end if;

  -- Only create the client when BOTH fields are usable: `clients.email` is
  -- NOT NULL and must contain an '@', so a name-without-email call would blow
  -- up the whole (atomic) signup rather than just skipping the client.
  if p_client_name is not null and btrim(p_client_name) <> ''
     and p_client_email is not null
     and position('@' in btrim(p_client_email)) > 1 then
    insert into public.clients (workspace_id, name, email)
    values (v_workspace, btrim(p_client_name), lower(btrim(p_client_email)))
    returning id into v_client;
  end if;

  return v_workspace;
end;
$$;

revoke all on function public.bootstrap_workspace(text, text, text) from public;
grant execute on function public.bootstrap_workspace(text, text, text) to authenticated;

-- Sign-offs are written server-side only (service role via a server action).
revoke insert, update, delete on public.signoffs from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 11. Verification helper — run this at the end of the migration.
-- -----------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(expected, ', ')
    into v_missing
  from unnest(array[
      'workspaces','clients','deliverables','signoffs'
    ]) as expected
   where not exists (
     select 1 from pg_tables
     where schemaname = 'public' and tablename = expected
   );

  if v_missing is not null then
    raise exception 'Migration incomplete, missing tables: %', v_missing;
  end if;

  raise notice 'ClientSync 0001_init applied: % tables, bucket %, % policies.',
    4, 'deliverables_bucket',
    (select count(*) from pg_policies where schemaname in ('public','storage'));
end $$;
