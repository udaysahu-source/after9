create table public.card_opens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('invite','story','story_join')),
  code text,
  created_at timestamptz not null default now()
);
alter table public.card_opens enable row level security;
create policy "owner reads own card opens" on public.card_opens for select to authenticated using (auth.uid() = owner_id);
grant select on public.card_opens to authenticated;

create or replace function public.log_card_open(_kind text, _code text default null, _ref uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare _owner uuid;
begin
  if _kind = 'invite' then
    select creator_id into _owner from invites where code = upper(_code);
  elsif _kind in ('story','story_join') then
    select id into _owner from profiles where id = _ref;
    if _kind = 'story_join' then
      if auth.uid() is null or auth.uid() = _ref then return; end if;
      if exists (select 1 from card_opens where kind='story_join' and owner_id=_owner and code = auth.uid()::text) then return; end if;
      _code := auth.uid()::text;
    else _code := null; end if;
  end if;
  if _owner is null then return; end if;
  insert into card_opens(owner_id, kind, code) values (_owner, _kind, upper(_code));
end $$;
grant execute on function public.log_card_open(text, text, uuid) to anon, authenticated;

create or replace function public.my_share_stats()
returns table(invite_opens int, invite_joins int, invite_finished int, story_opens int, story_joins int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from card_opens where owner_id = auth.uid() and kind='invite'),
    (select count(*)::int from invites where creator_id = auth.uid() and claimed_by is not null),
    (select count(*)::int from invites i join profiles p on p.id = i.claimed_by where i.creator_id = auth.uid() and p.onboarded),
    (select count(*)::int from card_opens where owner_id = auth.uid() and kind='story'),
    (select count(*)::int from card_opens where owner_id = auth.uid() and kind='story_join');
$$;
grant execute on function public.my_share_stats() to authenticated;