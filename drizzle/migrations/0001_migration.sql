alter table public.profiles add column invited_by uuid references public.profiles(id) on delete set null;

create table public.invites (
  code text primary key,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  revoked boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.invites to authenticated;
grant all on public.invites to service_role;
alter table public.invites enable row level security;
create policy "creator reads own invites" on public.invites for select to authenticated using (auth.uid() = creator_id);

-- invited_by is set only by the server
create or replace function public.guard_invited_by() returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then new.invited_by := null; else new.invited_by := old.invited_by; end if;
  end if;
  return new;
end $$;
create trigger guard_invited_by before insert or update on public.profiles for each row execute function public.guard_invited_by();