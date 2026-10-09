-- Migration 0010: Notifications & Web Push Subscriptions
-- Enables persistent in-app notifications for likes, mutual matches, and chat messages
-- Enforces idempotency, RLS, and privacy.

-- 1. Create notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like', 'match', 'message', 'system')),
  title text not null,
  body text not null,
  action_url text not null default '/discover',
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  source_id text,
  created_at timestamptz not null default now(),
  constraint uq_notifications_user_type_source unique (user_id, type, source_id)
);

create index if not exists idx_notifications_user_unread on public.notifications (user_id, read, created_at desc);

-- 2. Create push_subscriptions table
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_push_subscriptions_user_endpoint unique (user_id, endpoint)
);

-- 3. Add push_notifications_enabled to profiles
alter table public.profiles add column if not exists push_notifications_enabled boolean not null default true;

-- 4. Enable RLS
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'own notifications read') then
    create policy "own notifications read" on public.notifications
      for select to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'own notifications update') then
    create policy "own notifications update" on public.notifications
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'own subscriptions select') then
    create policy "own subscriptions select" on public.push_subscriptions
      for select to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'own subscriptions insert') then
    create policy "own subscriptions insert" on public.push_subscriptions
      for insert to authenticated with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'own subscriptions update') then
    create policy "own subscriptions update" on public.push_subscriptions
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

grant select, insert, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

grant select, insert, update on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- 5. Helper RPCs
create or replace function public.mark_all_notifications_read()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.notifications
  set read = true
  where user_id = auth.uid() and read = false;
end;
$$;
grant execute on function public.mark_all_notifications_read() to authenticated;

create or replace function public.get_unread_notification_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer
  from public.notifications
  where user_id = auth.uid() and read = false;
$$;
grant execute on function public.get_unread_notification_count() to authenticated;

-- 6. Trigger for dandiyas (swipes & mutual matches)
create or replace function public.handle_dandiya_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_mutual boolean := false;
  sender_name text;
  recipient_name text;
  smaller_id text;
  larger_id text;
  pair_source text;
begin
  if NEW.kind <> 'send' then
    return NEW;
  end if;

  -- Block check
  if exists (
    select 1 from public.blocks
    where (blocker_id = NEW.from_id and blocked_id = NEW.to_id)
       or (blocker_id = NEW.to_id and blocked_id = NEW.from_id)
  ) then
    return NEW;
  end if;

  select coalesce(first_name, 'Someone') into sender_name
  from public.profiles where id = NEW.from_id;

  select coalesce(first_name, 'Someone') into recipient_name
  from public.profiles where id = NEW.to_id;

  if NEW.from_id < NEW.to_id then
    smaller_id := NEW.from_id::text;
    larger_id := NEW.to_id::text;
  else
    smaller_id := NEW.to_id::text;
    larger_id := NEW.from_id::text;
  end if;
  pair_source := smaller_id || ':' || larger_id;

  is_mutual := exists (
    select 1 from public.dandiyas
    where from_id = NEW.to_id and to_id = NEW.from_id and kind = 'send'
  );

  if is_mutual then
    -- MUTUAL MATCH: Notify both users
    insert into public.notifications (user_id, type, title, body, action_url, data, source_id)
    values (
      NEW.to_id,
      'match',
      'It''s a match! 🎉',
      'You and ' || sender_name || ' liked each other.',
      '/chat/' || NEW.from_id,
      jsonb_build_object('match_id', NEW.from_id, 'partner_name', sender_name),
      pair_source
    )
    on conflict (user_id, type, source_id) do nothing;

    insert into public.notifications (user_id, type, title, body, action_url, data, source_id)
    values (
      NEW.from_id,
      'match',
      'It''s a match! 🎉',
      'You and ' || recipient_name || ' liked each other.',
      '/chat/' || NEW.to_id,
      jsonb_build_object('match_id', NEW.to_id, 'partner_name', recipient_name),
      pair_source
    )
    on conflict (user_id, type, source_id) do nothing;

    -- Mark any prior pending like notifications between this pair as read
    update public.notifications
    set read = true
    where type = 'like' and user_id in (NEW.from_id, NEW.to_id)
      and source_id in (NEW.from_id::text || ':' || NEW.to_id::text, NEW.to_id::text || ':' || NEW.from_id::text);
  else
    -- ONE-WAY LIKE: Keep sender anonymous
    insert into public.notifications (user_id, type, title, body, action_url, data, source_id)
    values (
      NEW.to_id,
      'like',
      'New Like 👀',
      'Someone''s interested in you 👀',
      '/discover',
      jsonb_build_object('kind', 'like'),
      NEW.from_id::text || ':' || NEW.to_id::text
    )
    on conflict (user_id, type, source_id) do nothing;
  end if;

  return NEW;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_dandiya_inserted') then
    create trigger on_dandiya_inserted
    after insert on public.dandiyas
    for each row execute function public.handle_dandiya_notification();
  end if;
end $$;

-- 7. Trigger for messages
create or replace function public.handle_message_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sender_name text;
begin
  select coalesce(first_name, 'Someone') into sender_name
  from public.profiles where id = NEW.sender_id;

  insert into public.notifications (user_id, type, title, body, action_url, data, source_id)
  values (
    NEW.recipient_id,
    'message',
    'New message',
    'New message from ' || sender_name,
    '/chat/' || NEW.sender_id,
    jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id),
    NEW.id::text
  )
  on conflict (user_id, type, source_id) do nothing;

  return NEW;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_message_inserted') then
    create trigger on_message_inserted
    after insert on public.messages
    for each row execute function public.handle_message_notification();
  end if;
end $$;

-- 8. Add notifications to Supabase Realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
