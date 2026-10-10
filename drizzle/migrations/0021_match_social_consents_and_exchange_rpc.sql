-- Migration 0021: Post-match Instagram communication flow and consent exchange
-- Adds match_social_consents table, strict RLS, and secure exchange RPCs

-- 1. Create match_social_consents table
CREATE TABLE IF NOT EXISTS public.match_social_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'instagram' CHECK (platform IN ('instagram', 'snapchat', 'youtube', 'x', 'linkedin', 'custom')),
  consented boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_social_consents_user_match_platform_key UNIQUE (user_id, match_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_match_social_consents_user_match 
  ON public.match_social_consents (user_id, match_id, platform);

-- 2. Row Level Security policies
ALTER TABLE public.match_social_consents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'match_social_consents' AND policyname = 'owner manages own social consents'
  ) THEN
    CREATE POLICY "owner manages own social consents"
      ON public.match_social_consents
      FOR ALL
      TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id AND public.is_match(user_id, match_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'match_social_consents' AND policyname = 'matched partner views consent status'
  ) THEN
    CREATE POLICY "matched partner views consent status"
      ON public.match_social_consents
      FOR SELECT
      TO authenticated
      USING ((select auth.uid()) = match_id AND public.is_match(user_id, match_id));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_social_consents TO authenticated;

-- 3. Consent Management RPC
CREATE OR REPLACE FUNCTION public.set_match_social_consent(
  _target_user_id uuid,
  _platform text DEFAULT 'instagram',
  _consent boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_me uuid;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_match(v_me, _target_user_id) THEN
    RAISE EXCEPTION 'Not a mutual clash or user is blocked';
  END IF;

  IF _consent THEN
    INSERT INTO public.match_social_consents (user_id, match_id, platform, consented, updated_at)
    VALUES (v_me, _target_user_id, _platform, true, now())
    ON CONFLICT (user_id, match_id, platform)
    DO UPDATE SET consented = true, updated_at = now();
  ELSE
    UPDATE public.match_social_consents
    SET consented = false, updated_at = now()
    WHERE user_id = v_me AND match_id = _target_user_id AND platform = _platform;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_match_social_consent(uuid, text, boolean) TO authenticated;

-- 4. Exchange & Reveal RPC (Enforces mutual consent before revealing handles)
CREATE OR REPLACE FUNCTION public.get_match_social_exchange(
  _target_user_id uuid,
  _platform text DEFAULT 'instagram'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_me uuid;
  v_is_match boolean;
  v_my_consent boolean := false;
  v_partner_consent boolean := false;
  v_partner_handle text := null;
  v_partner_url text := null;
  v_my_handle text := null;
  v_my_url text := null;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object(
      'is_match', false,
      'my_consent', false,
      'partner_consent', false,
      'both_consented', false,
      'partner_handle', null,
      'partner_url', null,
      'my_handle', null,
      'my_url', null
    );
  END IF;

  v_is_match := public.is_match(v_me, _target_user_id);
  IF NOT v_is_match THEN
    RETURN jsonb_build_object(
      'is_match', false,
      'my_consent', false,
      'partner_consent', false,
      'both_consented', false,
      'partner_handle', null,
      'partner_url', null,
      'my_handle', null,
      'my_url', null
    );
  END IF;

  -- Check my consent
  SELECT coalesce((
    SELECT consented 
    FROM public.match_social_consents 
    WHERE user_id = v_me AND match_id = _target_user_id AND platform = _platform
  ), false) INTO v_my_consent;

  -- Check partner consent
  SELECT coalesce((
    SELECT consented 
    FROM public.match_social_consents 
    WHERE user_id = _target_user_id AND match_id = v_me AND platform = _platform
  ), false) INTO v_partner_consent;

  -- Retrieve current user's own handle for this platform
  SELECT handle, profile_url INTO v_my_handle, v_my_url
  FROM public.social_links
  WHERE user_id = v_me AND platform = _platform AND is_enabled = true;

  -- Only reveal partner's handle if BOTH have explicitly consented AND is_match is true
  IF v_my_consent AND v_partner_consent THEN
    SELECT handle, profile_url INTO v_partner_handle, v_partner_url
    FROM public.social_links
    WHERE user_id = _target_user_id AND platform = _platform AND is_enabled = true;
  END IF;

  RETURN jsonb_build_object(
    'is_match', true,
    'my_consent', v_my_consent,
    'partner_consent', v_partner_consent,
    'both_consented', (v_my_consent AND v_partner_consent),
    'partner_handle', v_partner_handle,
    'partner_url', v_partner_url,
    'my_handle', v_my_handle,
    'my_url', v_my_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_match_social_exchange(uuid, text) TO authenticated;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
