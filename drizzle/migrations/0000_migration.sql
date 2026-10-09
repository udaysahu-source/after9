create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text, birth_date date, gender text, interested_in text not null default 'everyone',
  min_age int not null default 18, max_age int not null default 35,
  college text, branch text, prompt text, photo_path text,
  quiz jsonb not null default '{}'::jsonb, nights jsonb not null default '{}'::jsonb,
  onboarding_step int not null default 0, onboarded boolean not null default false,
  discoverable boolean not null default true, show_college boolean not null default true,
  verification_status text not null default 'pending', verification_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "own profile delete" on public.profiles for delete to authenticated using (auth.uid() = id);

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
  if new.birth_date is not null and new.birth_date > (current_date - interval '18 years') then
    raise exception 'After9 is for adults 18+';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger guard_profile before insert or update on public.profiles for each row execute function public.guard_profile();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name) values (new.id, nullif(coalesce(new.raw_user_meta_data->>'given_name', split_part(coalesce(new.raw_user_meta_data->>'full_name',''),' ',1)), '')) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.dandiyas (
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('send','pass')),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
grant select, insert, update, delete on public.dandiyas to authenticated;
grant all on public.dandiyas to service_role;
alter table public.dandiyas enable row level security;
create policy "own swipes" on public.dandiyas for select to authenticated using (auth.uid() = from_id);
create policy "swipe insert" on public.dandiyas for insert to authenticated with check (auth.uid() = from_id and from_id <> to_id);
create policy "swipe delete" on public.dandiyas for delete to authenticated using (auth.uid() = from_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  reason text, report boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;
alter table public.blocks enable row level security;
create policy "own blocks read" on public.blocks for select to authenticated using (auth.uid() = blocker_id);
create policy "own blocks write" on public.blocks for insert to authenticated with check (auth.uid() = blocker_id);
create policy "own blocks delete" on public.blocks for delete to authenticated using (auth.uid() = blocker_id);

create or replace function public.is_match(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from dandiyas where from_id=a and to_id=b and kind='send')
     and exists(select 1 from dandiyas where from_id=b and to_id=a and kind='send')
     and not exists(select 1 from blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "read own chats" on public.messages for select to authenticated using ((auth.uid() = sender_id or auth.uid() = recipient_id) and public.is_match(sender_id, recipient_id));
create policy "send to match" on public.messages for insert to authenticated with check (auth.uid() = sender_id and public.is_match(sender_id, recipient_id));
alter publication supabase_realtime add table public.messages;

create or replace function public.discover_feed() returns table (
  id uuid, first_name text, age int, college text, branch text, prompt text, photo_path text, nights jsonb, quiz jsonb
) language sql stable security definer set search_path = public as $$
  with me as (select * from profiles where id = auth.uid())
  select p.id, p.first_name, date_part('year', age(p.birth_date))::int, case when p.show_college then p.college end, case when p.show_college then p.branch end, p.prompt, p.photo_path, p.nights, p.quiz
  from profiles p, me
  where p.id <> me.id and p.onboarded and p.discoverable and p.verification_status = 'approved'
    and date_part('year', age(p.birth_date)) between me.min_age and me.max_age
    and (me.interested_in = 'everyone' or p.gender = me.interested_in)
    and not exists (select 1 from dandiyas d where d.from_id = me.id and d.to_id = p.id)
    and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
  order by p.created_at desc limit 50;
$$;

create or replace function public.my_matches() returns table (
  id uuid, first_name text, age int, college text, prompt text, photo_path text, nights jsonb, last_message text, last_at timestamptz
) language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, date_part('year', age(p.birth_date))::int, p.college, p.prompt, p.photo_path, p.nights,
    (select body from messages m where (m.sender_id=auth.uid() and m.recipient_id=p.id) or (m.sender_id=p.id and m.recipient_id=auth.uid()) order by created_at desc limit 1),
    (select created_at from messages m where (m.sender_id=auth.uid() and m.recipient_id=p.id) or (m.sender_id=p.id and m.recipient_id=auth.uid()) order by created_at desc limit 1)
  from profiles p where p.id <> auth.uid() and public.is_match(auth.uid(), p.id)
  order by 9 desc nulls last;
$$;
revoke execute on function public.discover_feed() from anon, public;
revoke execute on function public.my_matches() from anon, public;
grant execute on function public.discover_feed() to authenticated;
grant execute on function public.my_matches() to authenticated;
grant execute on function public.is_match(uuid, uuid) to authenticated;

create policy "upload own photo" on storage.objects for insert to authenticated with check (bucket_id='photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own photo" on storage.objects for update to authenticated using (bucket_id='photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photo" on storage.objects for delete to authenticated using (bucket_id='photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "signed in can view photos" on storage.objects for select to authenticated using (bucket_id='photos');