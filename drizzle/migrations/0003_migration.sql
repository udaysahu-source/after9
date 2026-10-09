create or replace function public.my_card_stats() returns table (seen int, dandiyas int, passes int, matches int, sent int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from dandiyas where to_id = auth.uid())::int,
    (select count(*) from dandiyas where to_id = auth.uid() and kind = 'send')::int,
    (select count(*) from dandiyas where to_id = auth.uid() and kind = 'pass')::int,
    (select count(*) from profiles p where p.id <> auth.uid() and public.is_match(auth.uid(), p.id))::int,
    (select count(*) from dandiyas where from_id = auth.uid() and kind = 'send')::int;
$$;
revoke execute on function public.my_card_stats() from anon, public;
grant execute on function public.my_card_stats() to authenticated;