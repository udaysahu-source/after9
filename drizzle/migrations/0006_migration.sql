alter table public.profiles add column if not exists incognito boolean not null default false;
create or replace function public.discover_feed()
 returns table(id uuid, first_name text, age integer, college text, branch text, prompt text, photo_path text, nights jsonb, quiz jsonb)
 language sql stable security definer set search_path to 'public'
as $$
  with me as (select * from profiles where id = auth.uid())
  select p.id, p.first_name, date_part('year', age(p.birth_date))::int, case when p.show_college then p.college end, case when p.show_college then p.branch end, p.prompt, p.photo_path, p.nights, p.quiz
  from profiles p, me
  where p.id <> me.id and p.onboarded and p.discoverable and p.verification_status = 'approved'
    and (not p.incognito or exists (select 1 from dandiyas d where d.from_id = p.id and d.to_id = me.id and d.kind = 'send'))
    and date_part('year', age(p.birth_date)) between me.min_age and me.max_age
    and (me.interested_in = 'everyone' or p.gender = me.interested_in)
    and not exists (select 1 from dandiyas d where d.from_id = me.id and d.to_id = p.id)
    and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
  order by p.created_at desc limit 50;
$$;