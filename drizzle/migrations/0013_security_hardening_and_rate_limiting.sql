-- Migration 0013: Security Hardening, RLS Defense, Privilege Escalation Prevention, and Distributed Rate Limiting

-- ==============================================================================
-- 1. HARDEN PROFILES TRIGGER: PREVENT MASS ASSIGNMENT & SUSPENSION TAMPERING
-- ==============================================================================
create or replace function public.guard_profile() returns trigger language plpgsql set search_path = public as $$
begin
  -- Prevent client-side manipulation of verification status and suspension flags
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.verification_status := 'pending';
      new.verification_reason := null;
      new.is_suspended := false;
      new.suspension_reason := null;
    else
      -- Block suspended accounts from making any profile changes
      if old.is_suspended = true then
        raise exception 'Account is suspended. Contact support for assistance.';
      end if;

      -- Preserve existing suspension state - only service_role / admin functions can modify
      new.is_suspended := old.is_suspended;
      new.suspension_reason := old.suspension_reason;

      -- If key identity attributes change, reset verification to pending
      if new.photo_path is distinct from old.photo_path or new.prompt is distinct from old.prompt or new.first_name is distinct from old.first_name then
        new.verification_status := 'pending';
        new.verification_reason := null;
      else
        new.verification_status := old.verification_status;
        new.verification_reason := old.verification_reason;
      end if;
    end if;
  end if;

  -- Strict 18+ adult age validation
  if new.birth_date is not null and new.birth_date > (current_date - interval '18 years') then
    raise exception 'After9 is strictly for adults 18+';
  end if;

  -- Age preference bounds validation
  if new.min_age is not null and new.min_age < 18 then
    raise exception 'Minimum age filter cannot be lower than 18';
  end if;

  if new.max_age is not null and new.min_age is not null and new.max_age < new.min_age then
    raise exception 'Maximum age filter cannot be less than minimum age';
  end if;

  -- Ensure visibility_audiences has valid default if empty
  if new.visibility_audiences is null or cardinality(new.visibility_audiences) = 0 then
    new.visibility_audiences := array['only_me']::text[];
  end if;

  new.updated_at := now();
  return new;
end $$;

-- ==============================================================================
-- 2. HARDEN MATCH & BLOCK ENFORCEMENT ACROSS ALL CALLS
-- ==============================================================================
create or replace function public.is_match(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.dandiyas where from_id=a and to_id=b and kind='send')
     and exists(select 1 from public.dandiyas where from_id=b and to_id=a and kind='send')
     and not exists(select 1 from public.blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a))
     and not exists(select 1 from public.profiles where id in (a, b) and is_suspended = true);
$$;
grant execute on function public.is_match(uuid, uuid) to authenticated;

-- Update discover_feed to strictly exclude suspended users and suspended caller
create or replace function public.discover_feed()
returns table (
  id uuid,
  first_name text,
  age int,
  college text,
  branch text,
  prompt text,
  photo_path text,
  nights jsonb,
  quiz jsonb
) language sql stable security definer set search_path = public as $$
  with launch as (
    select coalesce(discover_enabled, false) as enabled
    from public.launch_control
    where id = 'global'
    limit 1
  ),
  me as (select * from public.profiles where id = auth.uid())
  select
    p.id,
    p.first_name,
    date_part('year', age(p.birth_date))::int,
    case when p.show_college then p.college end,
    case when p.show_college then p.branch end,
    p.prompt,
    p.photo_path,
    p.nights,
    p.quiz
  from public.profiles p, me, launch
  where launch.enabled = true
    and me.is_suspended = false
    and p.is_suspended = false
    and p.id <> me.id
    and p.onboarded = true
    and p.discoverable = true
    and p.verification_status = 'approved'
    and (not p.incognito or exists (select 1 from public.dandiyas d where d.from_id = p.id and d.to_id = me.id and d.kind = 'send'))
    and date_part('year', age(p.birth_date)) between me.min_age and me.max_age
    and (me.interested_in = 'everyone' or p.gender = me.interested_in)
    and not exists (select 1 from public.dandiyas d where d.from_id = me.id and d.to_id = p.id)
    and not exists (select 1 from public.blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
    -- Profile Visibility Meter enforcement:
    and not ('only_me' = any(p.visibility_audiences))
    and (
      (
        'college' = any(p.visibility_audiences)
        and p.college is not null
        and me.college is not null
        and lower(trim(p.college)) = lower(trim(me.college))
      )
      or
      (
        'nearby' = any(p.visibility_audiences)
        and p.general_area is not null
        and me.general_area is not null
        and lower(trim(p.general_area)) = lower(trim(me.general_area))
      )
      or
      (
        'event' = any(p.visibility_audiences)
        and exists (
          select 1
          from jsonb_each_text(p.nights) pn
          join jsonb_each_text(me.nights) mn on mn.key = pn.key
          where pn.value in ('going', 'maybe') and mn.value in ('going', 'maybe')
        )
      )
    )
  order by p.created_at desc limit 50;
$$;
grant execute on function public.discover_feed() to authenticated;

-- Update my_matches to exclude suspended users
create or replace function public.my_matches() returns table (
  id uuid, first_name text, age int, college text, prompt text, photo_path text, nights jsonb, last_message text, last_at timestamptz
) language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, date_part('year', age(p.birth_date))::int, p.college, p.prompt, p.photo_path, p.nights,
    (select body from public.messages m where (m.sender_id=auth.uid() and m.recipient_id=p.id) or (m.sender_id=p.id and m.recipient_id=auth.uid()) order by created_at desc limit 1),
    (select created_at from public.messages m where (m.sender_id=auth.uid() and m.recipient_id=p.id) or (m.sender_id=p.id and m.recipient_id=auth.uid()) order by created_at desc limit 1)
  from public.profiles p
  where p.id <> auth.uid()
    and p.is_suspended = false
    and not exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_suspended = true)
    and public.is_match(auth.uid(), p.id)
  order by 9 desc nulls last;
$$;
grant execute on function public.my_matches() to authenticated;

-- Update my_likers to exclude suspended users
create or replace function public.my_likers()
returns table(id uuid, first_name text, age integer, college text, photo_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name,
         case when p.birth_date is null then null else date_part('year', age(p.birth_date))::int end,
         case when p.show_college then p.college end,
         p.photo_path
  from public.dandiyas d
  join public.profiles p on p.id = d.from_id
  where d.to_id = auth.uid() and d.kind = 'send'
    and p.is_suspended = false
    and not exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_suspended = true)
    and not exists (select 1 from public.dandiyas b where b.from_id = auth.uid() and b.to_id = d.from_id and b.kind = 'send')
    and not exists (select 1 from public.blocks bl where (bl.blocker_id = auth.uid() and bl.blocked_id = d.from_id) or (bl.blocker_id = d.from_id and bl.blocked_id = auth.uid()))
  order by d.created_at desc;
$$;
grant execute on function public.my_likers() to authenticated;

-- ==============================================================================
-- 3. HARDEN RLS POLICIES FOR SWIPES (DANDIYAS) AND MESSAGES
-- ==============================================================================
drop policy if exists "swipe insert" on public.dandiyas;
create policy "swipe insert" on public.dandiyas
  for insert to authenticated
  with check (
    auth.uid() = from_id
    and from_id <> to_id
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_suspended = true)
  );

drop policy if exists "send to match" on public.messages;
create policy "send to match" on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_suspended = true)
    and public.is_match(sender_id, recipient_id)
  );

-- ==============================================================================
-- 4. HARDEN STORAGE ACCESS (LEAST PRIVILEGE ON storage.objects)
-- ==============================================================================
-- Drop wide policy
drop policy if exists "signed in can view photos" on storage.objects;
drop policy if exists "strict photo read" on storage.objects;
drop policy if exists "public share card view photo" on storage.objects;

-- Authenticated user can read a photo ONLY IF:
-- 1) It's their own photo
-- 2) OR the photo belongs to an active, non-blocked, discoverable/approved user
-- 3) OR the photo belongs to a mutual match
create policy "strict photo read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      -- Own photo
      (storage.foldername(name))[1] = auth.uid()::text
      or
      -- Mutual match
      (
        (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_match(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
      or
      -- Discoverable, non-blocked user
      (
        (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = ((storage.foldername(name))[1])::uuid)
             or (b.blocker_id = ((storage.foldername(name))[1])::uuid and b.blocked_id = auth.uid())
        )
        and exists (
          select 1 from public.profiles p
          where p.id = ((storage.foldername(name))[1])::uuid
            and p.onboarded = true
            and p.discoverable = true
            and p.verification_status = 'approved'
            and p.is_suspended = false
            and not ('only_me' = any(p.visibility_audiences))
        )
      )
    )
  );

-- Public share card photo view for unauthenticated visitors (anon)
create policy "public share card view photo" on storage.objects
  for select to anon
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1 from public.profiles p
      where p.id = ((storage.foldername(name))[1])::uuid
        and p.public_profile_enabled = true
        and p.discoverable = true
        and p.verification_status = 'approved'
        and p.is_suspended = false
        and not ('only_me' = any(p.visibility_audiences))
    )
  );

-- ==============================================================================
-- 5. SERVER-SIDE DISTRIBUTED RATE LIMITING TABLE & ATOMIC RPC
-- ==============================================================================
create table if not exists public.security_rate_limits (
  key text primary key,
  count int not null default 1,
  reset_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.security_rate_limits enable row level security;
grant all on public.security_rate_limits to service_role;

-- Atomically check and increment rate limit window
create or replace function public.check_rate_limit(
  p_key text,
  p_max_attempts int,
  p_window_seconds int
)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_now timestamptz := now();
  v_record public.security_rate_limits%rowtype;
  v_allowed boolean;
  v_remaining int;
  v_reset_in int;
begin
  if length(p_key) > 200 then
    p_key := substr(p_key, 1, 200);
  end if;

  select * into v_record from public.security_rate_limits where key = p_key for update;

  if not found or v_record.reset_at <= v_now then
    insert into public.security_rate_limits (key, count, reset_at)
    values (p_key, 1, v_now + (p_window_seconds || ' seconds')::interval)
    on conflict (key) do update
      set count = 1, reset_at = v_now + (p_window_seconds || ' seconds')::interval;

    v_allowed := true;
    v_remaining := p_max_attempts - 1;
    v_reset_in := p_window_seconds;
  else
    if v_record.count < p_max_attempts then
      update public.security_rate_limits
      set count = count + 1
      where key = p_key;

      v_allowed := true;
      v_remaining := p_max_attempts - (v_record.count + 1);
    else
      v_allowed := false;
      v_remaining := 0;
    end if;
    v_reset_in := greatest(1, extract(epoch from (v_record.reset_at - v_now))::int);
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'remaining', greatest(0, v_remaining),
    'reset_in_seconds', v_reset_in
  );
end;
$$;
grant execute on function public.check_rate_limit(text, int, int) to authenticated, anon;

-- ==============================================================================
-- 6. SECURITY EVENTS MONITORING TABLE & AUDIT LOGGING
-- ==============================================================================
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warn', 'critical')),
  actor_id uuid references auth.users(id),
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.security_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'security_events' and policyname = 'admins read security_events'
  ) then
    create policy "admins read security_events" on public.security_events
      for select to authenticated
      using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active));
  end if;
end $$;

grant select on public.security_events to authenticated;
grant all on public.security_events to service_role;

create or replace function public.log_security_event(
  p_event_type text,
  p_severity text default 'info',
  p_ip_hash text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  insert into public.security_events (event_type, severity, actor_id, ip_hash, metadata)
  values (
    substr(p_event_type, 1, 100),
    case when p_severity in ('info', 'warn', 'critical') then p_severity else 'info' end,
    auth.uid(),
    substr(p_ip_hash, 1, 128),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;
grant execute on function public.log_security_event(text, text, text, jsonb) to authenticated, anon;

-- ==============================================================================
-- 7. HARDEN CARD OPENS (INPUT VALIDATION & ABUSE THROTTLING)
-- ==============================================================================
create or replace function public.log_card_open(_kind text, _code text default null, _ref uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  _owner uuid;
begin
  -- Validate inputs
  if _kind is null or length(_kind) > 30 then return; end if;
  if length(coalesce(_code, '')) > 50 then return; end if;

  if _kind = 'invite' then
    if _code is null then return; end if;
    select creator_id into _owner from public.invites where code = upper(_code);
  elsif _kind in ('story','story_join') then
    if _ref is null then return; end if;
    select id into _owner from public.profiles where id = _ref;
    if _kind = 'story_join' then
      if auth.uid() is null or auth.uid() = _ref then return; end if;
      if exists (select 1 from public.card_opens where kind='story_join' and owner_id=_owner and code = auth.uid()::text) then return; end if;
      _code := auth.uid()::text;
    else
      _code := null;
    end if;
  end if;

  if _owner is null then return; end if;

  -- Throttling: do not record duplicate rapid opens for same owner and kind within 2 minutes
  if exists (
    select 1 from public.card_opens
    where owner_id = _owner
      and kind = _kind
      and coalesce(code, '') = coalesce(upper(_code), '')
      and created_at > (now() - interval '2 minutes')
  ) then
    return;
  end if;

  insert into public.card_opens(owner_id, kind, code) values (_owner, _kind, upper(_code));
end $$;
grant execute on function public.log_card_open(text, text, uuid) to anon, authenticated;

-- ==============================================================================
-- 8. COMPATIBILITY & HELPER RPCS (get_matched_socials, regenerate_share_token, track_launch_event)
-- ==============================================================================
create or replace function public.get_matched_socials(target_user_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public as $$
declare
  v_res jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;

  if not public.is_match(auth.uid(), target_user_id) then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'platform', s.platform,
      'handle', s.handle,
      'profile_url', s.profile_url
    )
  ), '[]'::jsonb)
  into v_res
  from public.social_links s
  where s.user_id = target_user_id
    and s.is_enabled = true
    and s.visibility = 'matched';

  return v_res;
end;
$$;
grant execute on function public.get_matched_socials(uuid) to authenticated;

create or replace function public.regenerate_share_token()
returns text
language plpgsql
security definer
set search_path = public as $$
declare
  v_new_token text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Generate secure token using gen_random_uuid
  v_new_token := replace(gen_random_uuid()::text, '-', '');

  update public.profiles
  set share_token = v_new_token
  where id = auth.uid();

  return v_new_token;
end;
$$;
grant execute on function public.regenerate_share_token() to authenticated;

create or replace function public.track_launch_event(event_name text, properties jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  -- Validate permitted event names
  if event_name not in (
    'invite_shared', 'referral_registered', 'profile_completed',
    'night_selected', 'discovery_opened', 'eligible_returned',
    'dandiya_sent', 'match_created'
  ) then
    return;
  end if;

  -- Telemetry is safe and sanitized
  perform public.log_security_event('telemetry_' || event_name, 'info', null, jsonb_build_object('event', event_name));
end;
$$;
grant execute on function public.track_launch_event(text, properties jsonb) to authenticated, anon;
