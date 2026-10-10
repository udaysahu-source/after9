-- Migration 0015: Admin RLS Policies, Self-Healing is_admin, and Photo Verification Verdicts

-- 1. Ensure public.is_admin(p_user_id uuid) automatically matches and links unlinked admin emails
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Direct match on user_id
  IF EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = p_user_id AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- 2. Link by email from auth.users if unlinked
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE lower(email) = lower(v_email) AND is_active = true
  ) THEN
    UPDATE public.admin_users
    SET user_id = p_user_id
    WHERE lower(email) = lower(v_email) AND user_id IS NULL;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon;

-- 2. Grant Admin RLS Access to Profiles (select & update for moderation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'admins select all profiles'
  ) THEN
    CREATE POLICY "admins select all profiles" ON public.profiles
      FOR SELECT TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'admins update profiles'
  ) THEN
    CREATE POLICY "admins update profiles" ON public.profiles
      FOR UPDATE TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 3. Grant Admin RLS Access to Reported Blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocks' AND policyname = 'admins view reports'
  ) THEN
    CREATE POLICY "admins view reports" ON public.blocks
      FOR SELECT TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocks' AND policyname = 'admins update reports'
  ) THEN
    CREATE POLICY "admins update reports" ON public.blocks
      FOR UPDATE TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 4. Grant Admin RLS Access to Invites
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invites' AND policyname = 'admins manage all invites'
  ) THEN
    CREATE POLICY "admins manage all invites" ON public.invites
      FOR ALL TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 5. Grant Admin RLS Access to Events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'admins manage events'
  ) THEN
    CREATE POLICY "admins manage events" ON public.events
      FOR ALL TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 6. Grant Admin RLS Access to Audit Logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_audit_logs' AND policyname = 'admins insert audit logs'
  ) THEN
    CREATE POLICY "admins insert audit logs" ON public.admin_audit_logs
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 7. Grant Admin Read Access for Aggregates (dandiyas & messages metrics)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dandiyas' AND policyname = 'admins select dandiyas'
  ) THEN
    CREATE POLICY "admins select dandiyas" ON public.dandiyas
      FOR SELECT TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'admins select messages'
  ) THEN
    CREATE POLICY "admins select messages" ON public.messages
      FOR SELECT TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 8. Security Definer RPC for setting verification status (callable by admin or server check)
CREATE OR REPLACE FUNCTION public.set_profile_verification_verdict(
  p_user_id uuid,
  p_status text,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permitted if called by service role OR by authenticated admin OR for own pending/needs_review submission
  IF coalesce(auth.role(), '') = 'service_role' OR coalesce(public.is_admin(auth.uid()), false) THEN
    UPDATE public.profiles
    SET verification_status = p_status,
        verification_reason = p_reason
    WHERE id = p_user_id;
    RETURN true;
  END IF;

  -- User can submit their own profile for 'needs_review' or 'pending'
  IF auth.uid() = p_user_id AND p_status IN ('pending', 'needs_review') THEN
    UPDATE public.profiles
    SET verification_status = p_status,
        verification_reason = p_reason
    WHERE id = p_user_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_verification_verdict(uuid, text, text) TO authenticated, service_role;
