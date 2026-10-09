-- Migration 0008: Social links normalized table, visibility controls, and strict RLS policies
create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'snapchat', 'youtube', 'x', 'linkedin', 'custom')),
  handle text not null,
  profile_url text not null,
  is_enabled boolean not null default true,
  visibility text not null default 'private' check (visibility in ('private', 'share_card', 'matched')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_links_user_platform_key unique (user_id, platform)
);

-- Ensure visibility column exists if table was previously created without it
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'social_links' and column_name = 'visibility'
  ) then
    alter table public.social_links add column visibility text not null default 'private' check (visibility in ('private', 'share_card', 'matched'));
  end if;
end $$;

-- Enable Row Level Security
alter table public.social_links enable row level security;

-- Clean up existing policies for idempotent migration
drop policy if exists "owner manages own social links" on public.social_links;
drop policy if exists "owner reads own social links" on public.social_links;
drop policy if exists "owner inserts own social links" on public.social_links;
drop policy if exists "owner updates own social links" on public.social_links;
drop policy if exists "owner deletes own social links" on public.social_links;
drop policy if exists "matched users view mutual connections" on public.social_links;

-- Policy 1: Owner full access to their own social links
create policy "owner manages own social links"
  on public.social_links
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policy 2: Mutual matches can view links ONLY if enabled and visibility is set to 'matched'
create policy "matched users view mutual connections"
  on public.social_links
  for select
  to authenticated
  using (
    is_enabled = true
    and visibility = 'matched'
    and exists (
      select 1 from public.my_matches() m
      where m.id = social_links.user_id
    )
  );

grant select, insert, update, delete on public.social_links to authenticated;

-- Security-definer helper to safely retrieve matched social links without leaking private handles
create or replace function public.get_match_social_links(_target_user_id uuid)
returns table (
  platform text,
  handle text,
  profile_url text
) language sql stable security definer set search_path = public as $$
  select s.platform, s.handle, s.profile_url
  from public.social_links s
  where s.user_id = _target_user_id
    and s.is_enabled = true
    and s.visibility = 'matched'
    and exists (
      select 1 from public.my_matches() m
      where m.id = _target_user_id
    );
$$;

grant execute on function public.get_match_social_links(uuid) to authenticated;
