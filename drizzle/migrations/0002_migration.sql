create or replace function public.my_invites() returns table (
  code text, revoked boolean, expires_at timestamptz, created_at timestamptz, claimed_at timestamptz,
  friend_name text, friend_onboarded boolean, friend_status text
) language sql stable security definer set search_path = public as $$
  select i.code, i.revoked, i.expires_at, i.created_at, i.claimed_at, p.first_name, p.onboarded, p.verification_status
  from invites i left join profiles p on p.id = i.claimed_by
  where i.creator_id = auth.uid()
  order by i.created_at;
$$;
revoke execute on function public.my_invites() from anon, public;
grant execute on function public.my_invites() to authenticated;