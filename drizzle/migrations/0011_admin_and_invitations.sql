-- Migration 0011: Admin Dashboard, Audit Logging, and Authoritative Invitations

-- 1. Admin Users Table
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'admin' check (role in ('admin', 'super_admin', 'moderator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.admin_users enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_users' and policyname = 'admins read admin_users'
  ) then
    create policy "admins read admin_users" on public.admin_users
      for select to authenticated
      using (auth.uid() = user_id or exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active));
  end if;
end $$;

grant select on public.admin_users to authenticated;
grant all on public.admin_users to service_role;

-- 2. Admin Audit Logs Table
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_email text not null,
  action text not null,
  target_id text,
  details jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_audit_logs' and policyname = 'admins read audit_logs'
  ) then
    create policy "admins read audit_logs" on public.admin_audit_logs
      for select to authenticated
      using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active));
  end if;
end $$;

grant select on public.admin_audit_logs to authenticated;
grant all on public.admin_audit_logs to service_role;

-- 3. Events Table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  venue text not null,
  city text not null default 'Raipur',
  dates jsonb not null default '[]'::jsonb,
  organizer text,
  booking_url text,
  ticket_price_range text,
  price_source text,
  verification_status text not null default 'unverified' check (verification_status in ('verified', 'unverified', 'expired')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'anyone can view active events'
  ) then
    create policy "anyone can view active events" on public.events
      for select to authenticated using (is_active = true);
  end if;
end $$;

grant select on public.events to authenticated;
grant all on public.events to service_role;

-- 4. Extend blocks for moderation workflow
alter table public.blocks add column if not exists status text not null default 'pending' check (status in ('pending', 'investigating', 'resolved', 'dismissed'));
alter table public.blocks add column if not exists moderator_notes text;
alter table public.blocks add column if not exists resolved_at timestamptz;
alter table public.blocks add column if not exists resolved_by uuid references auth.users(id);

-- 5. Extend profiles for suspension
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists suspension_reason text;

-- 6. Helper function to check if user is admin
create or replace function public.is_admin(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users
    where user_id = p_user_id and is_active = true
  );
$$;
grant execute on function public.is_admin(uuid) to authenticated;

-- 7. Authoritative ensure_my_invites transactional RPC
create or replace function public.ensure_my_invites()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_total_valid int;
  v_missing int;
  v_primary_code text;
  v_available_count int;
  v_claimed_count int;
  v_invites jsonb;
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_expires timestamptz := now() + interval '30 days';
  i int;
  j int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'Not authenticated');
  end if;

  -- Lock row to prevent concurrent duplicate generation
  perform 1 from profiles where id = v_user_id for update;

  -- Count existing valid invites
  select count(*) into v_total_valid
  from invites
  where creator_id = v_user_id
    and revoked = false
    and (expires_at is null or expires_at > now());

  v_missing := 5 - coalesce(v_total_valid, 0);

  -- Generate missing invites if needed
  if v_missing > 0 then
    for i in 1..v_missing loop
      v_code := 'A9-';
      for j in 1..5 loop
        v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
      end loop;
      insert into invites (code, creator_id, expires_at)
      values (v_code, v_user_id, v_expires)
      on conflict (code) do nothing;
    end loop;
  end if;

  -- Get primary available code
  select code into v_primary_code
  from invites
  where creator_id = v_user_id
    and claimed_by is null
    and revoked = false
    and (expires_at is null or expires_at > now())
  order by created_at asc
  limit 1;

  -- Count available (unclaimed)
  select count(*) into v_available_count
  from invites
  where creator_id = v_user_id
    and claimed_by is null
    and revoked = false
    and (expires_at is null or expires_at > now());

  -- Count claimed
  select count(*) into v_claimed_count
  from invites
  where creator_id = v_user_id
    and claimed_by is not null;

  -- Build invites list
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'code', inv.code,
      'revoked', inv.revoked,
      'expires_at', inv.expires_at,
      'created_at', inv.created_at,
      'claimed_at', inv.claimed_at,
      'friend_name', prof.first_name,
      'friend_onboarded', coalesce(prof.onboarded, false),
      'friend_status', prof.verification_status
    ) order by inv.created_at asc
  ), '[]'::jsonb)
  into v_invites
  from invites inv
  left join profiles prof on prof.id = inv.claimed_by
  where inv.creator_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'primary_code', v_primary_code,
    'available_count', coalesce(v_available_count, 0),
    'claimed_count', coalesce(v_claimed_count, 0),
    'total_allocation', 5,
    'invites', v_invites
  );
end;
$$;
grant execute on function public.ensure_my_invites() to authenticated;
