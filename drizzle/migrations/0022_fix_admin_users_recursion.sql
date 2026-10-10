-- Migration 0022: Fix infinite recursion in admin_users RLS policy
-- Author: After9 Architecture
-- Description: Replaces self-referencing subquery with security definer is_admin(auth.uid()) check.

alter policy "admins read admin_users" on public.admin_users
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
