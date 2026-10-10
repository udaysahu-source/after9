-- Migration 0014: Unlimited Referrals, Operational Metrics Privacy, and Responsible Photo Verification

-- 1. Create table for tracking individual referral attributions safely without limits
CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_referee UNIQUE (referee_id),
  CONSTRAINT no_self_referral CHECK (referrer_id <> referee_id)
);

ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referral_attributions' AND policyname = 'Referrers view own attributions'
  ) THEN
    CREATE POLICY "Referrers view own attributions" ON public.referral_attributions
      FOR SELECT TO authenticated
      USING (auth.uid() = referrer_id OR auth.uid() = referee_id);
  END IF;
END $$;

GRANT SELECT ON public.referral_attributions TO authenticated;
GRANT ALL ON public.referral_attributions TO service_role;

-- 2. Update ensure_my_invites: Eliminate 5-invite cap, provide a single persistent referral code per user
CREATE OR REPLACE FUNCTION public.ensure_my_invites()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_primary_code text;
  v_claimed_count int;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  j int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Not authenticated');
  END IF;

  -- Lock profile row
  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;

  -- Look for an existing primary invite code for this user
  SELECT code INTO v_primary_code
  FROM public.invites
  WHERE creator_id = v_user_id
    AND revoked = false
  ORDER BY created_at ASC
  LIMIT 1;

  -- If user has no code yet, generate one persistent referral code
  IF v_primary_code IS NULL THEN
    v_code := 'A9-';
    FOR j IN 1..5 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;

    INSERT INTO public.invites (code, creator_id, expires_at)
    VALUES (v_code, v_user_id, NULL) -- Persistent: no expiry
    ON CONFLICT (code) DO NOTHING;

    v_primary_code := v_code;
  END IF;

  -- Count real people who successfully joined through this user's referral link
  SELECT count(*) INTO v_claimed_count
  FROM public.profiles
  WHERE invited_by = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'primary_code', v_primary_code,
    'available_count', 999999, -- Unlimited sharing
    'total_allocation', 999999,
    'claimed_count', coalesce(v_claimed_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_invites() TO authenticated;

-- 3. Update get_launch_control: Never leak operational metrics to non-admins across public API!
CREATE OR REPLACE FUNCTION public.get_launch_control()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_is_admin boolean;
  v_total_users int;
  v_completed_profiles int;
  v_discoverable_users int;
  v_city_counts jsonb;
  v_night_counts jsonb;
BEGIN
  SELECT * INTO v_rec FROM public.launch_control WHERE id = 'global' LIMIT 1;
  
  -- Check if caller is admin
  v_is_admin := public.is_admin(auth.uid());

  -- Ordinary users receive ONLY the public discover_enabled state!
  IF NOT coalesce(v_is_admin, false) THEN
    RETURN jsonb_build_object(
      'discover_enabled', coalesce(v_rec.discover_enabled, false)
    );
  END IF;

  -- Administrators receive real operational readiness metrics:
  SELECT count(*) INTO v_total_users FROM public.profiles;
  SELECT count(*) INTO v_completed_profiles FROM public.profiles WHERE onboarded = true;
  SELECT count(*) INTO v_discoverable_users FROM public.profiles WHERE onboarded = true AND discoverable = true AND is_suspended = false;

  SELECT coalesce(jsonb_object_agg(coalesce(nullif(trim(general_area), ''), 'Raipur'), cnt), '{}'::jsonb)
  INTO v_city_counts
  FROM (
    SELECT coalesce(nullif(trim(general_area), ''), 'Raipur') AS general_area, count(*) AS cnt
    FROM public.profiles
    WHERE onboarded = true
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 10
  ) c;

  SELECT jsonb_build_object(
    '1', count(*) FILTER (WHERE nights ? '1' AND (nights->>'1')::text IN ('going', 'maybe')),
    '2', count(*) FILTER (WHERE nights ? '2' AND (nights->>'2')::text IN ('going', 'maybe')),
    '3', count(*) FILTER (WHERE nights ? '3' AND (nights->>'3')::text IN ('going', 'maybe')),
    '4', count(*) FILTER (WHERE nights ? '4' AND (nights->>'4')::text IN ('going', 'maybe')),
    '5', count(*) FILTER (WHERE nights ? '5' AND (nights->>'5')::text IN ('going', 'maybe')),
    '6', count(*) FILTER (WHERE nights ? '6' AND (nights->>'6')::text IN ('going', 'maybe')),
    '7', count(*) FILTER (WHERE nights ? '7' AND (nights->>'7')::text IN ('going', 'maybe')),
    '8', count(*) FILTER (WHERE nights ? '8' AND (nights->>'8')::text IN ('going', 'maybe')),
    '9', count(*) FILTER (WHERE nights ? '9' AND (nights->>'9')::text IN ('going', 'maybe'))
  )
  INTO v_night_counts
  FROM public.profiles
  WHERE onboarded = true;

  RETURN jsonb_build_object(
    'discover_enabled', coalesce(v_rec.discover_enabled, false),
    'readiness_target', coalesce(v_rec.readiness_target, 50),
    'last_changed_by_email', v_rec.last_changed_by_email,
    'last_changed_at', v_rec.last_changed_at,
    'total_registered_users', v_total_users,
    'completed_profiles_count', v_completed_profiles,
    'eligible_users_count', v_discoverable_users,
    'city_counts', v_city_counts,
    'night_counts', v_night_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_launch_control() TO authenticated, anon;
