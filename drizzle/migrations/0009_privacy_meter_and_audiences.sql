-- Migration 0009: Profile Visibility Meter, Coarse Geographic Discovery, and Shortened Onboarding Support

-- 1. Add visibility_audiences and general_area to profiles
alter table public.profiles
  add column if not exists visibility_audiences text[] not null default array['only_me']::text[],
  add column if not exists general_area text;

-- Add check constraint on visibility_audiences
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'valid_visibility_audiences'
  ) then
    alter table public.profiles
      add constraint valid_visibility_audiences
      check (visibility_audiences <@ array['only_me', 'college', 'nearby', 'event']::text[]);
  end if;
end $$;

-- 2. Guard profile trigger update: enforce 18+ eligibility and valid age bounds
create or replace function public.guard_profile() returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.verification_status := 'pending'; new.verification_reason := null;
    else
      if new.photo_path is distinct from old.photo_path or new.prompt is distinct from old.prompt or new.first_name is distinct from old.first_name then
        new.verification_status := 'pending'; new.verification_reason := null;
      else
        new.verification_status := old.verification_status; new.verification_reason := old.verification_reason;
      end if;
    end if;
  end if;

  -- 18+ adult age validation
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

-- 3. Update discover_feed() to enforce visibility audiences, coarse area, and college matching
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
  with me as (select * from profiles where id = auth.uid())
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
  from profiles p, me
  where p.id <> me.id
    and p.onboarded = true
    and p.discoverable = true
    and p.verification_status = 'approved'
    and (not p.incognito or exists (select 1 from dandiyas d where d.from_id = p.id and d.to_id = me.id and d.kind = 'send'))
    and date_part('year', age(p.birth_date)) between me.min_age and me.max_age
    and (me.interested_in = 'everyone' or p.gender = me.interested_in)
    and not exists (select 1 from dandiyas d where d.from_id = me.id and d.to_id = p.id)
    and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
    -- Profile Visibility Meter enforcement:
    -- Target user p must not have 'only_me' active
    and not ('only_me' = any(p.visibility_audiences))
    -- Viewer me must qualify under at least one of target user p's chosen audiences:
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

-- 4. Update discover_diagnostics() to reflect audience filters
create or replace function public.discover_diagnostics()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  current_uid uuid;
  me profiles%rowtype;
  total_active_others integer;
  swiped_count integer;
  filter_match_count integer;
  eligible_unswiped integer;
  night_counts jsonb;
  my_nights_count integer;
begin
  current_uid := auth.uid();
  if current_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select * into me from profiles where id = current_uid;
  if me.id is null then
    return jsonb_build_object('error', 'no_profile');
  end if;

  -- 1. Total other approved, discoverable, onboarded profiles on platform (excluding blocked, excluding only_me)
  select count(*)::integer into total_active_others
  from profiles p
  where p.id <> current_uid
    and p.onboarded = true
    and p.discoverable = true
    and p.verification_status = 'approved'
    and not ('only_me' = any(p.visibility_audiences))
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = current_uid and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = current_uid)
    );

  -- 2. Count of profiles caller has already swiped on
  select count(*)::integer into swiped_count
  from dandiyas d
  where d.from_id = current_uid;

  -- 3. Count of active profiles matching caller demographic + audience filters before swipes
  select count(*)::integer into filter_match_count
  from profiles p
  where p.id <> current_uid
    and p.onboarded = true
    and p.discoverable = true
    and p.verification_status = 'approved'
    and not ('only_me' = any(p.visibility_audiences))
    and date_part('year', age(p.birth_date)) between me.min_age and me.max_age
    and (me.interested_in = 'everyone' or p.gender = me.interested_in)
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = current_uid and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = current_uid)
    )
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
    );

  -- 4. Count of unswiped eligible profiles currently returned by discover_feed()
  select count(*)::integer into eligible_unswiped
  from discover_feed();

  -- 5. Night attendance breakdown for matching eligible users
  select jsonb_object_agg(n.night::text, coalesce(cnt.c, 0)) into night_counts
  from generate_series(1, 9) as n(night)
  left join (
    select (k.key)::int as night_num, count(*)::int as c
    from discover_feed() df,
    lateral jsonb_each_text(df.nights) k
    where k.value <> 'off'
    group by (k.key)::int
  ) cnt on cnt.night_num = n.night;

  -- 6. How many nights caller is going
  select count(*)::integer into my_nights_count
  from jsonb_each_text(coalesce(me.nights, '{}'::jsonb))
  where value <> 'off';

  return jsonb_build_object(
    'total_active_others', total_active_others,
    'swiped_count', swiped_count,
    'filter_match_count', filter_match_count,
    'eligible_unswiped', eligible_unswiped,
    'night_counts', coalesce(night_counts, '{}'::jsonb),
    'my_nights_count', my_nights_count,
    'my_min_age', me.min_age,
    'my_max_age', me.max_age,
    'my_interested_in', me.interested_in
  );
end;
$$;
grant execute on function public.discover_diagnostics() to authenticated;

-- 5. Update get_public_profile(token text) to protect private/hidden profiles and private social links
create or replace function public.get_public_profile(token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  prof record;
  socials jsonb;
  calc_age int;
begin
  select * into prof
  from public.profiles
  where share_token = token
    and public_profile_enabled = true
    and discoverable = true
    and not ('only_me' = any(visibility_audiences))
    and onboarded = true
    and verification_status = 'approved';

  if prof.id is null then
    return null;
  end if;

  calc_age := extract(year from age(current_date, prof.birth_date))::int;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'platform', s.platform,
      'handle', s.handle,
      'profile_url', s.profile_url
    )
  ), '[]'::jsonb) into socials
  from public.social_links s
  where s.user_id = prof.id
    and s.is_enabled = true
    and s.visibility = 'share_card';

  return jsonb_build_object(
    'id', prof.id,
    'share_token', prof.share_token,
    'first_name', prof.first_name,
    'age', calc_age,
    'college', case when prof.show_college then prof.college else null end,
    'branch', case when prof.show_college then prof.branch else null end,
    'general_area', prof.general_area,
    'prompt', prof.prompt,
    'nights', prof.nights,
    'photo_path', prof.photo_path,
    'card_preferences', coalesce(prof.card_preferences, '{}'::jsonb),
    'social_links', socials
  );
end;
$$;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- 6. Update handle_new_user() trigger for new auth registrations
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, visibility_audiences, discoverable)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data->>'given_name', split_part(coalesce(new.raw_user_meta_data->>'full_name',''),' ',1)), ''),
    array['only_me']::text[],
    true
  ) on conflict (id) do nothing;
  return new;
end $$;
