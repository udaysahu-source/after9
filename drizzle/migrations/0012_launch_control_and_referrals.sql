-- Migration 0012: Launch Control and Discover Feature Flag

-- 1. Create launch_control table
create table if not exists public.launch_control (
  id text primary key default 'global',
  discover_enabled boolean not null default false,
  readiness_target integer not null default 50,
  last_changed_by uuid references auth.users(id),
  last_changed_by_email text,
  last_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insert initial global launch control record if not exists
insert into public.launch_control (id, discover_enabled, readiness_target, last_changed_by_email)
values ('global', false, 50, 'system@after9.app')
on conflict (id) do nothing;

alter table public.launch_control enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'launch_control' and policyname = 'anyone can read launch_control'
  ) then
    create policy "anyone can read launch_control" on public.launch_control
      for select to authenticated, anon using (true);
  end if;
end $$;

grant select on public.launch_control to authenticated, anon;
grant all on public.launch_control to service_role;

-- 2. Function to fetch launch control state and real metrics
create or replace function public.get_launch_control()
returns jsonb
language plpgsql
stable security definer
set search_path = public as $$
declare
  v_rec record;
  v_total_users int;
  v_completed_profiles int;
  v_discoverable_users int;
  v_city_counts jsonb;
  v_night_counts jsonb;
begin
  select * into v_rec from public.launch_control where id = 'global' limit 1;
  
  select count(*) into v_total_users from public.profiles;
  select count(*) into v_completed_profiles from public.profiles where onboarded = true;
  select count(*) into v_discoverable_users from public.profiles where onboarded = true and discoverable = true and is_suspended = false;

  -- Group by general_area / city
  select coalesce(jsonb_object_agg(coalesce(nullif(trim(general_area), ''), 'Raipur'), cnt), '{}'::jsonb)
  into v_city_counts
  from (
    select coalesce(nullif(trim(general_area), ''), 'Raipur') as general_area, count(*) as cnt
    from public.profiles
    where onboarded = true
    group by 1
    order by cnt desc
    limit 10
  ) c;

  -- Aggregate attendance across nights 1 to 9
  select jsonb_build_object(
    '1', count(*) filter (where nights ? '1' and (nights->>'1')::text in ('going', 'maybe')),
    '2', count(*) filter (where nights ? '2' and (nights->>'2')::text in ('going', 'maybe')),
    '3', count(*) filter (where nights ? '3' and (nights->>'3')::text in ('going', 'maybe')),
    '4', count(*) filter (where nights ? '4' and (nights->>'4')::text in ('going', 'maybe')),
    '5', count(*) filter (where nights ? '5' and (nights->>'5')::text in ('going', 'maybe')),
    '6', count(*) filter (where nights ? '6' and (nights->>'6')::text in ('going', 'maybe')),
    '7', count(*) filter (where nights ? '7' and (nights->>'7')::text in ('going', 'maybe')),
    '8', count(*) filter (where nights ? '8' and (nights->>'8')::text in ('going', 'maybe')),
    '9', count(*) filter (where nights ? '9' and (nights->>'9')::text in ('going', 'maybe'))
  )
  into v_night_counts
  from public.profiles
  where onboarded = true;

  return jsonb_build_object(
    'discover_enabled', coalesce(v_rec.discover_enabled, false),
    'readiness_target', coalesce(v_rec.readiness_target, 50),
    'last_changed_by_email', v_rec.last_changed_by_email,
    'last_changed_at', v_rec.last_changed_at,
    'total_registered_users', v_total_users,
    'completed_profiles_count', v_completed_profiles,
    'eligible_users_count', v_discoverable_users,
    'city_counts', v_city_counts,
    'night_counts', v_night_counts
  );
end;
$$;

grant execute on function public.get_launch_control() to authenticated, anon;

-- 3. Update discover_feed() to enforce launch_control.discover_enabled
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
  me as (select * from profiles where id = auth.uid())
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
  from profiles p, me, launch
  where launch.enabled = true
    and p.id <> me.id
    and p.onboarded = true
    and p.discoverable = true
    and p.verification_status = 'approved'
    and (not p.incognito or exists (select 1 from dandiyas d where d.from_id = p.id and d.to_id = me.id and d.kind = 'send'))
    and date_part('year', age(p.birth_date)) between me.min_age and me.max_age
    and (me.interested_in = 'everyone' or p.gender = me.interested_in)
    and not exists (select 1 from dandiyas d where d.from_id = me.id and d.to_id = p.id)
    and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
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
